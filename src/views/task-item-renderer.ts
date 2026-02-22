import { setIcon, Menu, Platform, App } from "obsidian";
import type { TaskItem } from "../types";
import { isOverdue, isToday, formatRelativeDate } from "../utils/date-utils";
import { CREATED_DATE_EMOJI } from "../constants";
import { attachDragHandle } from "./drag-handler";

export type TaskActionType =
  | "toggle"
  | "delete"
  | "edit"
  | "add-subtask"
  | "set-due"
  | "archive"
  | "edit-notes"
  | "insert-link";

export interface TaskActionEvent {
  action: TaskActionType;
  task: TaskItem;
  value?: string;
  parentTask?: TaskItem;
}

export interface RenderTaskOptions {
  addingSubtaskFor?: string | null;
  editingNotesFor?: string | null;
  onSubtaskSubmit?: (parentTask: TaskItem, text: string) => void;
  onSubtaskCancel?: () => void;
  onNotesSubmit?: (task: TaskItem, notes: string) => void;
  onNotesCancel?: () => void;
  onReorder?: (orderedIds: string[], parentTask?: TaskItem) => void;
  onDragStateChange?: (dragging: boolean) => void;
  app?: App;
  sourcePath?: string;
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
      "aria-label": task.completed ? "Mark as incomplete" : "Mark as complete",
    },
  });
  checkbox.checked = task.completed;
  checkbox.addEventListener("change", () => {
    onAction({ action: "toggle", task, parentTask });
  });

  // Content area (text + inline edit input)
  const contentArea = rowEl.createDiv({ cls: "zen-todo-task-content" });

  const textSpan = contentArea.createSpan({
    cls: "zen-todo-task-text",
    attr: {
      tabindex: "0",
      role: "button",
      "aria-label": "Edit task",
    },
  });
  if (task.text.includes("[[") && options.app) {
    renderWikiLinkedText(
      textSpan,
      task.text,
      options.app,
      options.sourcePath ?? "",
    );
  } else {
    textSpan.textContent = task.text;
  }

  // Edit input — hidden by default, toggled on click
  const editInput = contentArea.createEl("input", {
    type: "text",
    cls: "zen-todo-task-edit-input is-hidden",
    attr: { "aria-label": "Edit task text" },
  });
  // リンク済みタスクは中身だけ表示する（[[...]] を剥がす）
  const linkedMatch = task.text.match(/^\[\[([^\]]+)\]\]$/);
  const wasLinked = !!linkedMatch;
  editInput.value = wasLinked ? linkedMatch![1] : task.text;

  const startEditing = () => {
    textSpan.addClass("is-hidden");
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
    if (wasLinked) newText = `[[${newText}]]`;
    if (newText !== task.text) {
      onAction({ action: "edit", task, value: newText, parentTask });
    } else {
      // Restore text span
      editInput.addClass("is-hidden");
      textSpan.removeClass("is-hidden");
      editSaved = false;
    }
  };

  const cancelEdit = () => {
    editInput.value = wasLinked ? linkedMatch![1] : task.text;
    editInput.addClass("is-hidden");
    textSpan.removeClass("is-hidden");
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
    attr: { "aria-label": "Due date" },
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
      "aria-label": "Set due date",
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

  // Notes button
  const notesBtn = actionsEl.createEl("button", {
    cls: `zen-todo-action-btn${task.notes ? " has-notes" : ""}`,
    attr: {
      "aria-label": "Edit notes",
      "data-tooltip-position": "top",
    },
  });
  setIcon(notesBtn, "message-square");
  notesBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onAction({ action: "edit-notes", task, parentTask });
  });

  // Link button
  const linkBtn = actionsEl.createEl("button", {
    cls: "zen-todo-action-btn",
    attr: {
      "aria-label": "Insert link",
      "data-tooltip-position": "top",
    },
  });
  setIcon(linkBtn, "link");
  linkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onAction({ action: "insert-link", task, parentTask });
  });

  // Add subtask button (root tasks only, not completed)
  if (!parentTask && !task.completed) {
    const addSubBtn = actionsEl.createEl("button", {
      cls: "zen-todo-action-btn",
      attr: {
        "aria-label": "Add subtask",
        "data-tooltip-position": "top",
      },
    });
    setIcon(addSubBtn, "plus");
    addSubBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onAction({ action: "add-subtask", task, parentTask });
    });
  }

  // Archive button (completed root tasks only)
  if (!parentTask && task.completed) {
    const archiveBtn = actionsEl.createEl("button", {
      cls: "zen-todo-action-btn zen-todo-archive-btn",
      attr: {
        "aria-label": "Archive task",
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
      "aria-label": "Delete task",
      "data-tooltip-position": "top",
    },
  });
  setIcon(delBtn, "trash-2");
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onAction({ action: "delete", task, parentTask });
  });

  // Drag handle
  if (options.onReorder) {
    attachDragHandle(
      itemEl,
      rowEl,
      container,
      task.id,
      (orderedIds) => options.onReorder!(orderedIds, parentTask),
      options.onDragStateChange,
    );
  }

  // ── Mobile: long-press context menu ──
  if (Platform.isMobile) {
    addLongPressHandler(rowEl, (e) => {
      const menu = new Menu();

      menu.addItem((item) => {
        item
          .setTitle("Edit")
          .setIcon("pencil")
          .onClick(() => {
            startEditing();
          });
      });

      if (!parentTask) {
        menu.addItem((item) => {
          item
            .setTitle("Add subtask")
            .setIcon("plus")
            .onClick(() => {
              onAction({ action: "add-subtask", task, parentTask });
            });
        });
      }

      menu.addItem((item) => {
        item
          .setTitle("Edit notes")
          .setIcon("message-square")
          .onClick(() => {
            onAction({ action: "edit-notes", task, parentTask });
          });
      });

      menu.addItem((item) => {
        item
          .setTitle("Insert link")
          .setIcon("link")
          .onClick(() => {
            onAction({ action: "insert-link", task, parentTask });
          });
      });

      menu.addItem((item) => {
        item
          .setTitle("Set due date")
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

      if (!parentTask && task.completed) {
        menu.addItem((item) => {
          item
            .setTitle("Archive")
            .setIcon("archive")
            .onClick(() => {
              onAction({ action: "archive", task, parentTask });
            });
        });
      }

      menu.addItem((item) => {
        item
          .setTitle("Delete")
          .setIcon("trash-2")
          .onClick(() => {
            onAction({ action: "delete", task, parentTask });
          });
      });

      const touch = e.touches[0];
      menu.showAtPosition({ x: touch.clientX, y: touch.clientY });
    });
  }

  // Notes display (when not editing)
  if (task.notes && options.editingNotesFor !== task.id) {
    itemEl.createDiv({ cls: "zen-todo-task-notes", text: task.notes });
  }

  // Notes textarea (when editing)
  if (options.editingNotesFor === task.id) {
    const notesTextarea = itemEl.createEl("textarea", {
      cls: "zen-todo-notes-textarea",
      attr: { "aria-label": "Task notes" },
    });
    notesTextarea.value = task.notes ?? "";

    let notesDone = false;

    const commitNotes = () => {
      if (notesDone) return;
      notesDone = true;
      options.onNotesSubmit?.(task, notesTextarea.value);
    };

    const cancelNotes = () => {
      if (notesDone) return;
      notesDone = true;
      options.onNotesCancel?.();
    };

    notesTextarea.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          e.stopPropagation();
          commitNotes();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelNotes();
        }
      },
      true,
    ); // capture phase: intercept before Obsidian global hotkeys

    const actionsEl = itemEl.createDiv({ cls: "zen-todo-notes-actions" });
    const saveBtn = actionsEl.createEl("button", {
      cls: "zen-todo-notes-save-btn",
      attr: { type: "button", "aria-label": "Save notes (Cmd+Enter)" },
    });
    setIcon(saveBtn, "check");
    saveBtn.createSpan({ text: "保存" });
    saveBtn.addEventListener("click", () => {
      commitNotes();
    });

    notesTextarea.addEventListener("blur", () => {
      setTimeout(() => {
        if (notesTextarea.isConnected) commitNotes();
      }, 150);
    });

    setTimeout(() => {
      notesTextarea.focus();
      notesTextarea.setSelectionRange(
        notesTextarea.value.length,
        notesTextarea.value.length,
      );
    }, 0);
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

function renderWikiLinkedText(
  container: HTMLElement,
  text: string,
  app: App,
  sourcePath: string,
): void {
  const wikiLinkRegex = /\[\[([^\]]+?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = wikiLinkRegex.exec(text)) !== null) {
    // Plain text before this link
    if (match.index > lastIndex) {
      container.appendText(text.slice(lastIndex, match.index));
    }

    const inner = match[1];
    // Support [[target#heading|display]] or [[target|display]] or [[target#heading]] or [[target]]
    const pipeIdx = inner.indexOf("|");
    const linkTarget = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner;
    const displayText = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : inner;

    const linkEl = container.createEl("a", {
      cls: "internal-link",
      text: displayText,
      attr: { href: linkTarget },
    });

    // Check if the target file exists
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

    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    container.appendText(text.slice(lastIndex));
  }
}

function addLongPressHandler(
  el: HTMLElement,
  callback: (e: TouchEvent) => void,
  duration = 500,
): void {
  let timer: number | null = null;

  el.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
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
    () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
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
      placeholder: "Add a subtask...",
      "aria-label": "New subtask text",
    },
  });

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
