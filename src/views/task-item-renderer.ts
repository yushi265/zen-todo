import { setIcon, Menu, Platform, App } from "obsidian";
import type { TaskItem } from "../types";
import { isOverdue, isToday, formatRelativeDate } from "../utils/date-utils";
import { CREATED_DATE_EMOJI } from "../constants";
import { attachDragHandle } from "./drag-handler";
import { t } from "../i18n";
import { formatTaskTextWithTags, parseTaskInput } from "../models/task";
import {
  attachSmartUrlPaste,
  parseBareUrlAt,
  parseMarkdownExternalLinkAt,
  parseWikiLinkAt,
} from "../utils/link-utils";

export type TaskActionType =
  | "toggle"
  | "delete"
  | "edit"
  | "add-subtask"
  | "set-due"
  | "archive"
  | "insert-link"
  | "remove-link"
  | "move";

export interface TaskActionEvent {
  action: TaskActionType;
  task: TaskItem;
  value?: string;
  parentTask?: TaskItem;
  targetFilePath?: string;
}

export interface RenderTaskOptions {
  addingSubtaskFor?: string | null;
  onSubtaskSubmit?: (parentTask: TaskItem, text: string) => void;
  onSubtaskCancel?: () => void;
  onReorder?: (orderedIds: string[], parentTask?: TaskItem) => void;
  onDragStateChange?: (dragging: boolean) => void;
  onNest?: (draggedTaskId: string, targetTaskId: string) => void;
  onUnnest?: (taskId: string, dropIndex: number) => void;
  subtaskDragOnly?: boolean;  // trueならルートタスクのドラッグハンドルをスキップ
  app?: App;
  sourcePath?: string;
  moveTargets?: { filePath: string; title: string }[];
}

export function renderTaskItem(
  container: HTMLElement,
  task: TaskItem,
  onAction: (event: TaskActionEvent) => void,
  parentTask?: TaskItem,
  options: RenderTaskOptions = {},
): void {
  const itemEl = container.createDiv({
    cls: `zen-todo-task-item${task.completed ? " is-completed" : ""}`,
    attr: { "data-task-id": task.id },
  });

  // Row wrapper: checkbox + content + badges + actions (horizontal)
  const rowEl = itemEl.createDiv({ cls: "zen-todo-task-row" });

  // Checkbox
  const checkbox = rowEl.createEl("input", {
    type: "checkbox",
    cls: "zen-todo-checkbox",
    attr: {
      "aria-label": task.completed ? t("task.markIncomplete") : t("task.markComplete"),
    },
  });
  checkbox.checked = task.completed;
  checkbox.addEventListener("change", () => {
    onAction({ action: "toggle", task, parentTask });
  });

  // Content area (text + inline edit input)
  const contentArea = rowEl.createDiv({ cls: "zen-todo-task-content" });
  const primaryLine = contentArea.createDiv({ cls: "zen-todo-task-primary-line" });

  const textSpan = primaryLine.createSpan({
    cls: "zen-todo-task-text",
    attr: {
      tabindex: "0",
      role: "button",
      "aria-label": t("task.editLabel"),
    },
  });
  renderTaskText(textSpan, task.text, options.app, options.sourcePath ?? "");

  const tagsEl = task.tags.length > 0 ? renderTaskTags(primaryLine, task.tags) : null;

  // Edit input — hidden by default, toggled on click
  const editInput = contentArea.createEl("input", {
    type: "text",
    cls: "zen-todo-task-edit-input is-hidden",
    attr: { "aria-label": t("task.editInputLabel") },
  });
  attachSmartUrlPaste(editInput);
  // リンク済みタスクは中身だけ表示する（[[...]] を剥がす）
  const linkedMatch = task.text.match(/^\[\[([^\]]+)\]\]$/);
  const wasLinked = !!linkedMatch;
  editInput.value = wasLinked
    ? formatTaskTextWithTags(linkedMatch![1], task.tags)
    : formatTaskTextWithTags(task.text, task.tags);

  const startEditing = () => {
    textSpan.addClass("is-hidden");
    tagsEl?.addClass("is-hidden");
    editInput.removeClass("is-hidden");
    editInput.focus();
    editInput.select();
  };

  let editSaved = false;

  const saveEdit = () => {
    if (editSaved) return;
    editSaved = true;
    let newText = editInput.value.trim();
    if (!newText) {
      cancelEdit();
      return;
    }
    // リンク済みタスクは自動で [[...]] を再付与
    if (wasLinked) {
      const parsed = parseTaskInput(newText);
      if (!parsed.text) {
        cancelEdit();
        return;
      }
      newText = formatTaskTextWithTags(`[[${parsed.text}]]`, parsed.tags);
    }
    if (newText !== formatTaskTextWithTags(task.text, task.tags)) {
      onAction({ action: "edit", task, value: newText, parentTask });
    } else {
      // Restore text span
      editInput.addClass("is-hidden");
      textSpan.removeClass("is-hidden");
      tagsEl?.removeClass("is-hidden");
      editSaved = false;
    }
  };

  const cancelEdit = () => {
    editInput.value = wasLinked
      ? formatTaskTextWithTags(linkedMatch![1], task.tags)
      : formatTaskTextWithTags(task.text, task.tags);
    editInput.addClass("is-hidden");
    textSpan.removeClass("is-hidden");
    tagsEl?.removeClass("is-hidden");
    editSaved = false;
  };

  if (!Platform.isMobile) {
    textSpan.addEventListener("click", startEditing);
  }
  textSpan.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startEditing();
    }
  });

  editInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  });
  editInput.addEventListener("blur", saveEdit);

  // Mobile subline: created date + due date
  if (
    Platform.isMobile &&
    (task.createdDate || (task.dueDate && !task.completed))
  ) {
    const subline = contentArea.createDiv({ cls: "zen-todo-task-subline" });
    if (task.createdDate) {
      subline.createSpan({
        cls: "zen-todo-created-subline",
        text: `${CREATED_DATE_EMOJI} ${formatRelativeDate(task.createdDate)}`,
      });
    }
    if (task.dueDate && !task.completed) {
      const dueBadge = subline.createSpan({ cls: "zen-todo-due-badge" });
      if (isOverdue(task.dueDate)) {
        dueBadge.addClass("is-overdue");
        dueBadge.textContent = `⚠️ ${task.dueDate}`;
      } else if (isToday(task.dueDate)) {
        dueBadge.addClass("is-today");
        dueBadge.textContent = `🔔 ${task.dueDate}`;
      } else {
        dueBadge.textContent = `📅 ${task.dueDate}`;
      }
    }
  }

  // Created date badge (desktop only)
  if (task.createdDate && !Platform.isMobile) {
    rowEl.createSpan({
      cls: "zen-todo-created-badge",
      text: `${CREATED_DATE_EMOJI} ${formatRelativeDate(task.createdDate)}`,
    });
  }

  // Due date badge (desktop: inline in row; mobile: shown in subline above)
  if (task.dueDate && !task.completed) {
    if (isOverdue(task.dueDate)) {
      rowEl.addClass("is-overdue");
    } else if (isToday(task.dueDate)) {
      rowEl.addClass("is-due-today");
    }
    if (!Platform.isMobile) {
      const badge = rowEl.createSpan({ cls: "zen-todo-due-badge" });
      if (isOverdue(task.dueDate)) {
        badge.addClass("is-overdue");
        badge.textContent = `⚠️ ${task.dueDate}`;
      } else if (isToday(task.dueDate)) {
        badge.addClass("is-today");
        badge.textContent = `🔔 ${task.dueDate}`;
      } else {
        badge.textContent = `📅 ${task.dueDate}`;
      }
    }
  }

  // Done date badge
  if (task.completed && task.doneDate) {
    rowEl.createSpan({
      cls: "zen-todo-done-badge",
      text: `✅ ${task.doneDate}`,
    });
  }

  // Actions area
  const actionsEl = rowEl.createDiv({ cls: "zen-todo-task-actions" });

  // Inline date input — hidden by default, shown by calendar button
  const dateInput = actionsEl.createEl("input", {
    type: "date",
    cls: "zen-todo-inline-date is-hidden",
    attr: { "aria-label": t("task.dueDateLabel") },
  });
  if (task.dueDate) dateInput.value = task.dueDate;

  dateInput.addEventListener("change", () => {
    onAction({
      action: "set-due",
      task,
      value: dateInput.value || undefined,
      parentTask,
    });
    dateInput.addClass("is-hidden");
  });
  dateInput.addEventListener("blur", () => {
    // Small delay to allow change event to fire first
    setTimeout(() => dateInput.addClass("is-hidden"), 150);
  });

  // Calendar button
  const calBtn = actionsEl.createEl("button", {
    cls: "zen-todo-action-btn",
    attr: {
      "aria-label": t("task.setDueDate"),
      "data-tooltip-position": "top",
    },
  });
  setIcon(calBtn, "calendar");
  calBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dateInput.removeClass("is-hidden");
    dateInput.focus();
    (
      dateInput as HTMLInputElement & { showPicker?: () => void }
    ).showPicker?.();
  });

  // Link button (toggles based on link state)
  const isLinked = task.text.includes("[[");
  const linkBtn = actionsEl.createEl("button", {
    cls: "zen-todo-action-btn",
    attr: {
      "aria-label": isLinked ? t("task.removeLink") : t("task.insertLink"),
      "data-tooltip-position": "top",
    },
  });
  setIcon(linkBtn, isLinked ? "unlink" : "link");
  linkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onAction({ action: isLinked ? "remove-link" : "insert-link", task, parentTask });
  });

  // Add subtask button (root tasks only, not completed)
  if (!parentTask && !task.completed) {
    const addSubBtn = actionsEl.createEl("button", {
      cls: "zen-todo-action-btn",
      attr: {
        "aria-label": t("task.addSubtask"),
        "data-tooltip-position": "top",
      },
    });
    setIcon(addSubBtn, "plus");
    addSubBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onAction({ action: "add-subtask", task, parentTask });
    });
  }

  // Move button (root tasks only, when move targets are available)
  if (!parentTask && options.moveTargets && options.moveTargets.length > 0) {
    const moveBtn = actionsEl.createEl("button", {
      cls: "zen-todo-action-btn",
      attr: {
        "aria-label": t("task.moveToList"),
        "data-tooltip-position": "top",
      },
    });
    setIcon(moveBtn, "arrow-right-from-line");
    moveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = new Menu();
      for (const target of options.moveTargets!) {
        menu.addItem((item) => {
          item
            .setTitle(target.title)
            .setIcon("file-text")
            .onClick(() => {
              onAction({ action: "move", task, targetFilePath: target.filePath });
            });
        });
      }
      menu.showAtPosition({ x: e.clientX, y: e.clientY });
    });
  }

  // Archive button (completed root tasks only)
  if (!parentTask && task.completed) {
    const archiveBtn = actionsEl.createEl("button", {
      cls: "zen-todo-action-btn zen-todo-archive-btn",
      attr: {
        "aria-label": t("task.archive"),
        "data-tooltip-position": "top",
      },
    });
    setIcon(archiveBtn, "archive");
    archiveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onAction({ action: "archive", task, parentTask });
    });
  }

  // Delete button
  const delBtn = actionsEl.createEl("button", {
    cls: "zen-todo-action-btn zen-todo-delete-btn",
    attr: {
      "aria-label": t("task.delete"),
      "data-tooltip-position": "top",
    },
  });
  setIcon(delBtn, "trash-2");
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onAction({ action: "delete", task, parentTask });
  });

  // Drag handle (root tasks only for nest; subtasks can reorder within parent)
  if (options.onReorder && (!options.subtaskDragOnly || !!parentTask)) {
    attachDragHandle(
      itemEl,
      rowEl,
      container,
      task.id,
      (orderedIds) => options.onReorder!(orderedIds, parentTask),
      options.onDragStateChange,
      !parentTask ? options.onNest : undefined,
      parentTask ? options.onUnnest : undefined,
    );
  }

  // ── Mobile: long-press context menu ──
  if (Platform.isMobile) {
    addLongPressHandler(rowEl, (e) => {
      const menu = new Menu();

      menu.addItem((item) => {
        item
          .setTitle(t("menu.edit"))
          .setIcon("pencil")
          .onClick(() => {
            startEditing();
          });
      });

      if (!parentTask) {
        menu.addItem((item) => {
          item
            .setTitle(t("menu.addSubtask"))
            .setIcon("plus")
            .onClick(() => {
              onAction({ action: "add-subtask", task, parentTask });
            });
        });
      }

      menu.addItem((item) => {
        const mIsLinked = task.text.includes("[[");
        item
          .setTitle(mIsLinked ? t("menu.removeLink") : t("menu.insertLink"))
          .setIcon(mIsLinked ? "unlink" : "link")
          .onClick(() => {
            onAction({ action: mIsLinked ? "remove-link" : "insert-link", task, parentTask });
          });
      });

      menu.addItem((item) => {
        item
          .setTitle(t("menu.setDueDate"))
          .setIcon("calendar")
          .onClick(() => {
            const tmpDate = createEl("input", { type: "date" });
            if (task.dueDate) tmpDate.value = task.dueDate;
            tmpDate.setCssStyles({
              position: "absolute",
              opacity: "0",
              pointerEvents: "none",
            });
            rowEl.appendChild(tmpDate);
            tmpDate.addEventListener("change", () => {
              onAction({
                action: "set-due",
                task,
                value: tmpDate.value || undefined,
                parentTask,
              });
              tmpDate.remove();
            });
            tmpDate.addEventListener("blur", () => {
              setTimeout(() => tmpDate.remove(), 200);
            });
            try {
              (
                tmpDate as HTMLInputElement & { showPicker?: () => void }
              ).showPicker?.();
            } catch {
              tmpDate.click();
            }
          });
      });

      if (!parentTask && options.moveTargets && options.moveTargets.length > 0) {
        menu.addItem((item) => {
          item
            .setTitle(t("menu.moveTo"))
            .setIcon("arrow-right-from-line")
            .onClick(() => {
              const moveMenu = new Menu();
              for (const target of options.moveTargets!) {
                moveMenu.addItem((mi) => {
                  mi
                    .setTitle(target.title)
                    .setIcon("file-text")
                    .onClick(() => {
                      onAction({ action: "move", task, targetFilePath: target.filePath });
                    });
                });
              }
              const touch2 = e.touches[0];
              moveMenu.showAtPosition({ x: touch2.clientX, y: touch2.clientY });
            });
        });
      }

      if (!parentTask && task.completed) {
        menu.addItem((item) => {
          item
            .setTitle(t("menu.archive"))
            .setIcon("archive")
            .onClick(() => {
              onAction({ action: "archive", task, parentTask });
            });
        });
      }

      menu.addItem((item) => {
        item
          .setTitle(t("menu.delete"))
          .setIcon("trash-2")
          .onClick(() => {
            onAction({ action: "delete", task, parentTask });
          });
      });

      const touch = e.touches[0];
      menu.showAtPosition({ x: touch.clientX, y: touch.clientY });
    });
  }

  // Subtasks container
  if (task.subtasks.length > 0 || options.addingSubtaskFor === task.id) {
    const subtasksEl = itemEl.createDiv({ cls: "zen-todo-subtasks" });
    for (const subtask of task.subtasks) {
      renderTaskItem(subtasksEl, subtask, onAction, task, options);
    }
    if (options.addingSubtaskFor === task.id && options.onSubtaskSubmit) {
      renderSubtaskInput(
        subtasksEl,
        task,
        options.onSubtaskSubmit,
        options.onSubtaskCancel ?? (() => {}),
      );
    }
  }
}

export function renderTaskText(
  container: HTMLElement,
  text: string,
  app?: App,
  sourcePath?: string,
): void {
  let lastPlainIndex = 0;
  let index = 0;

  while (index < text.length) {
    const markdownLink = parseMarkdownExternalLinkAt(text, index);
    if (markdownLink) {
      if (index > lastPlainIndex) {
        container.appendText(text.slice(lastPlainIndex, index));
      }
      renderExternalLink(container, markdownLink.label, markdownLink.url);
      index = markdownLink.endIndex;
      lastPlainIndex = index;
      continue;
    }

    const wikiLink = parseWikiLinkAt(text, index);
    if (wikiLink) {
      if (index > lastPlainIndex) {
        container.appendText(text.slice(lastPlainIndex, index));
      }
      renderInternalLink(
        container,
        wikiLink.displayText,
        wikiLink.linkTarget,
        app,
        sourcePath,
      );
      index = wikiLink.endIndex;
      lastPlainIndex = index;
      continue;
    }

    const bareUrl = parseBareUrlAt(text, index);
    if (bareUrl) {
      if (index > lastPlainIndex) {
        container.appendText(text.slice(lastPlainIndex, index));
      }
      renderExternalLink(container, bareUrl.url, bareUrl.url);
      if (bareUrl.trailingText) {
        container.appendText(bareUrl.trailingText);
      }
      index = bareUrl.endIndex;
      lastPlainIndex = index;
      continue;
    }

    index += 1;
  }

  if (lastPlainIndex < text.length) {
    container.appendText(text.slice(lastPlainIndex));
  }
}

/** @deprecated Use renderTaskText instead */
export function renderWikiLinkedText(
  container: HTMLElement,
  text: string,
  app: App,
  sourcePath: string,
): void {
  renderTaskText(container, text, app, sourcePath);
}

function renderTaskTags(container: HTMLElement, tags: string[]): HTMLElement {
  const tagsEl = container.createDiv({ cls: "zen-todo-task-tags" });
  for (const tag of tags) {
    tagsEl.createSpan({
      cls: "zen-todo-task-tag",
      text: `#${tag}`,
    });
  }
  return tagsEl;
}

function addLongPressHandler(
  el: HTMLElement,
  callback: (e: TouchEvent) => void,
  duration = 500,
): void {
  let timer: number | null = null;
  let startX = 0;
  let startY = 0;
  const DEAD_ZONE = 10;

  el.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      timer = window.setTimeout(() => {
        // Prevent the subsequent tap/click from firing
        el.addEventListener(
          "click",
          (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
          },
          { once: true, capture: true },
        );
        callback(e);
        timer = null;
      }, duration);
    },
    { passive: true },
  );

  el.addEventListener("touchend", () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });

  el.addEventListener(
    "touchmove",
    (e: TouchEvent) => {
      if (timer) {
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (dx * dx + dy * dy > DEAD_ZONE * DEAD_ZONE) {
          clearTimeout(timer);
          timer = null;
        }
      }
    },
    { passive: true },
  );
}

function renderSubtaskInput(
  container: HTMLElement,
  parentTask: TaskItem,
  onSubmit: (parentTask: TaskItem, text: string) => void,
  onCancel: () => void,
): void {
  const row = container.createDiv({ cls: "zen-todo-subtask-input-row" });
  const input = row.createEl("input", {
    type: "text",
    cls: "zen-todo-subtask-input",
    attr: {
      placeholder: t("subtask.placeholder"),
      "aria-label": t("subtask.ariaLabel"),
    },
  });
  attachSmartUrlPaste(input);

  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    onSubmit(parentTask, text);
  };

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  });

  input.addEventListener("blur", () => {
    // 少し遅延して、Enter の submit と競合しないようにする
    // DOM再構築で要素が消えた場合はキャンセルしない（isConnected チェック）
    setTimeout(() => {
      if (input.isConnected) onCancel();
    }, 150);
  });

  // Defer focus so the render cycle completes first
  setTimeout(() => input.focus(), 0);
}

function renderInternalLink(
  container: HTMLElement,
  displayText: string,
  linkTarget: string,
  app?: App,
  sourcePath?: string,
): void {
  const linkEl = container.createEl("a", {
    cls: "internal-link",
    text: displayText,
    attr: { href: linkTarget },
  });

  if (app && sourcePath !== undefined) {
    const targetFile = app.metadataCache.getFirstLinkpathDest(
      linkTarget.split("#")[0],
      sourcePath,
    );
    if (!targetFile) {
      linkEl.addClass("is-unresolved");
    }
    linkEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      app.workspace.openLinkText(linkTarget, sourcePath);
    });
  } else {
    linkEl.addEventListener("click", (e) => e.stopPropagation());
  }
}

function renderExternalLink(
  container: HTMLElement,
  displayText: string,
  url: string,
): void {
  const linkEl = container.createEl("a", {
    cls: "external-link",
    text: displayText,
    attr: { href: url, target: "_blank", rel: "noopener" },
  });
  linkEl.addEventListener("click", (e) => e.stopPropagation());
}
