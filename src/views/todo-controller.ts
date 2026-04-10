import { App, TFile, Modal, normalizePath, setIcon } from "obsidian";
import { t } from "../i18n";
import type {
  TodoList,
  TaskItem,
  ZenTodoSettings,
  UndoState,
  ListSnapshot,
  UndoActionType,
  SortKey,
  SortDirection,
} from "../types";
import { parseMarkdown } from "../parser/markdown-parser";
import {
  serializeToMarkdown,
  serializeTaskToLines,
} from "../parser/markdown-serializer";
import { renderListSelector } from "./list-selector";
import { renderTaskInput } from "./task-input";
import { renderTaskSection } from "./task-section";
import type { TaskActionEvent } from "./task-item-renderer";
import {
  attachCrossListDragHandle,
  type ListGroupInfo,
} from "./cross-list-drag-handler";
import {
  createTask,
  completeTask,
  uncompleteTask,
  allSubtasksCompleted,
  cloneTasks,
  sortTasks,
  findTaskInTree,
  removeTaskFromTree,
  parseTaskInput,
} from "../models/task";
import { ALL_LISTS_PATH } from "../constants";

export interface ZenTodoControllerDeps {
  app: App;
  settings: ZenTodoSettings;
  saveSettings: () => Promise<void>;
}

export class ZenTodoController {
  private app: App;
  private settings: ZenTodoSettings;
  private _saveSettings: () => Promise<void>;
  private containerEl: HTMLElement;
  private onCreateNew?: () => void;

  activeFilePath: string | null = null;
  private lists: TodoList[] = [];
  private addingSubtaskFor: string | null = null;
  isSaving = false;
  private isDragging = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldFocusTaskInput = false;
  private undoState: UndoState | null = null;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private activeSortKey: SortKey | null = null;
  private activeSortDirection: SortDirection | null = null;
  private allViewSelectedList: string | null = null;

  private static readonly DEFAULT_SORT_DIRECTIONS: Record<SortKey, SortDirection> = {
    manual: "asc",
    dueDate: "asc",
    createdDate: "desc",
    alphabetical: "asc",
  };

  constructor(
    deps: ZenTodoControllerDeps,
    containerEl: HTMLElement,
    onCreateNew?: () => void,
  ) {
    this.app = deps.app;
    this.settings = deps.settings;
    this._saveSettings = deps.saveSettings;
    this.containerEl = containerEl;
    this.onCreateNew = onCreateNew;
  }

  async initialize(): Promise<void> {
    await this.loadLists();
    this.render();
  }

  destroy(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.clearUndo();
  }

  /** Called when a todo file changes externally. */
  onExternalChange(_filePath: string): void {
    if (this.isSaving || this.isDragging) return;
    this.clearUndo();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      await this.loadLists();
      this.render();
    }, 300);
  }

  async createNewList(): Promise<void> {
    new NewListModal(this.app, async (name) => {
      const folder = normalizePath(this.settings.todoFolder);
      const folderAbstract = this.app.vault.getAbstractFileByPath(folder);
      if (!folderAbstract) {
        await this.app.vault.createFolder(folder);
      }
      const filePath = normalizePath(`${folder}/${name}.md`);
      const content = serializeToMarkdown(name, []);
      const file = await this.app.vault.create(filePath, content);
      this.activeFilePath = file.path;
      await this.loadLists();
      this.render();
    }).open();
  }

  // ------------------------------------------------------------------ //
  // Private helpers
  // ------------------------------------------------------------------ //

  private async loadLists(): Promise<void> {
    const folder = normalizePath(this.settings.todoFolder);
    const files = this.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(folder + "/") && f.extension === "md");

    const hidden = new Set(this.settings.hiddenLists);
    this.lists = (
      await Promise.all(
        files.map(async (file) => {
          const content = await this.app.vault.read(file);
          const { title, description, tasks, archivedSection } = parseMarkdown(content);
          return { filePath: file.path, title, description, tasks, archivedSection };
        }),
      )
    ).filter((l) => !hidden.has(l.filePath));

    this.sortListsByOrder();
    await this.reconcileListOrder();
    await this.reconcileHiddenLists();

    if (this.lists.length > 0) {
      if (this.activeFilePath === ALL_LISTS_PATH) {
        // All view — keep as-is
      } else {
        const stillExists = this.lists.some(
          (l) => l.filePath === this.activeFilePath,
        );
        if (!stillExists) this.activeFilePath = this.lists[0].filePath;
      }
    } else {
      this.activeFilePath = null;
    }
  }

  private sortListsByOrder(): void {
    const order = this.settings.listOrder;
    if (order.length === 0) return;
    this.lists.sort((a, b) => {
      const ai = order.indexOf(a.filePath);
      const bi = order.indexOf(b.filePath);
      const aIdx = ai === -1 ? Infinity : ai;
      const bIdx = bi === -1 ? Infinity : bi;
      return aIdx - bIdx;
    });
  }

  private async reconcileListOrder(): Promise<void> {
    const validPaths = new Set(this.lists.map((l) => l.filePath));
    const cleaned = this.settings.listOrder.filter((p) => validPaths.has(p));
    if (cleaned.length !== this.settings.listOrder.length) {
      this.settings.listOrder = cleaned;
      await this._saveSettings();
    }
  }

  private async reconcileHiddenLists(): Promise<void> {
    const allFiles = new Set(
      this.app.vault
        .getFiles()
        .filter((f) => {
          const folder = normalizePath(this.settings.todoFolder);
          return f.path.startsWith(folder + "/") && f.extension === "md";
        })
        .map((f) => f.path),
    );
    const cleaned = this.settings.hiddenLists.filter((p) => allFiles.has(p));
    if (cleaned.length !== this.settings.hiddenLists.length) {
      this.settings.hiddenLists = cleaned;
      await this._saveSettings();
    }
  }

  private async reorderLists(orderedFilePaths: string[]): Promise<void> {
    this.settings.listOrder = orderedFilePaths;
    await this._saveSettings();
    this.sortListsByOrder();
    this.render();
  }

  async renameList(filePath: string, newName: string): Promise<void> {
    const sanitized = newName.replace(/[\\/:*?"<>|]/g, "").trim();
    if (!sanitized) return;

    const list = this.lists.find((l) => l.filePath === filePath);
    if (!list) return;

    list.title = sanitized;
    this.isSaving = true;
    try {
      // Save file with updated title heading
      const abstract = this.app.vault.getAbstractFileByPath(filePath);
      if (abstract instanceof TFile) {
        const content = serializeToMarkdown(
          list.title,
          list.tasks,
          list.archivedSection,
          list.description,
        );
        await this.app.vault.process(abstract, () => content);
      }

      // Compute new file path
      const folder = normalizePath(this.settings.todoFolder);
      const newPath = normalizePath(`${folder}/${sanitized}.md`);

      if (newPath !== filePath) {
        const existing = this.app.vault.getAbstractFileByPath(newPath);
        if (!existing) {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile) {
            await this.app.vault.rename(file, newPath);
            if (this.activeFilePath === filePath) {
              this.activeFilePath = newPath;
            }
          }
        }
      }

      await this.loadLists();
    } finally {
      this.isSaving = false;
    }
    this.render();
  }

  async hideList(filePath: string): Promise<void> {
    if (!this.settings.hiddenLists.includes(filePath)) {
      this.settings.hiddenLists = [...this.settings.hiddenLists, filePath];
      await this._saveSettings();
    }
    if (this.activeFilePath === filePath) this.activeFilePath = null;
    await this.loadLists();
    this.render();
  }

  async unhideList(filePath: string): Promise<void> {
    this.settings.hiddenLists = this.settings.hiddenLists.filter((p) => p !== filePath);
    await this._saveSettings();
    await this.loadLists();
    this.render();
  }

  private getCurrentSortKey(): SortKey {
    return this.activeSortKey ?? this.settings.defaultSortKey;
  }

  private getCurrentSortDirection(): SortDirection {
    return this.activeSortDirection ?? ZenTodoController.DEFAULT_SORT_DIRECTIONS[this.getCurrentSortKey()];
  }

  private getActiveList(): TodoList | null {
    if (!this.activeFilePath || this.activeFilePath === ALL_LISTS_PATH) return null;
    return this.lists.find((l) => l.filePath === this.activeFilePath) ?? null;
  }

  private getMoveTargets(currentFilePath: string): { filePath: string; title: string }[] {
    return this.lists
      .filter((l) => l.filePath !== currentFilePath)
      .map((l) => ({ filePath: l.filePath, title: l.title }));
  }

  render(): void {
    const el = this.containerEl;
    el.empty();

    const selectorEl = el.createDiv({ cls: "zen-todo-selector-wrapper" });
    renderListSelector(
      selectorEl,
      this.lists,
      this.activeFilePath,
      (fp) => {
        this.activeFilePath = fp;
        this.addingSubtaskFor = null;
        this.activeSortKey = null;
        this.activeSortDirection = null;
        this.allViewSelectedList = null;
        this.render();
      },
      this.onCreateNew,
      (orderedFilePaths) => this.reorderLists(orderedFilePaths),
      (filePath, newName) => this.renameList(filePath, newName),
      async (filePath) => {
        const list = this.lists.find((l) => l.filePath === filePath);
        if (!list) return;
        const confirmed = await new Promise<boolean>((resolve) => {
          new ConfirmModal(
            this.app,
            t("modal.hideList.title"),
            t("modal.hideList.message", { name: list.title }),
            t("modal.hideList.confirm"),
            t("modal.hideList.cancel"),
            resolve,
          ).open();
        });
        if (confirmed) await this.hideList(filePath);
      },
    );

    // All view
    if (this.activeFilePath === ALL_LISTS_PATH) {
      this.renderAllView(el);
      this.renderUndoToast(el);
      return;
    }

    const activeList = this.getActiveList();
    if (!activeList) {
      const emptyEl = el.createDiv({ cls: "zen-todo-no-list" });
      emptyEl.createEl("p", { text: t("noLists.message") });
      emptyEl.createEl("p", {
        text: t("noLists.hint", { folder: this.settings.todoFolder }),
      });
      return;
    }

    const descEl = el.createDiv({ cls: "zen-todo-description" });
    this.renderDescription(descEl, activeList);

    const inputEl = el.createDiv({ cls: "zen-todo-input-wrapper" });
    renderTaskInput(inputEl, (text, dueDate) =>
      this.addTask(activeList, text, dueDate),
    );
    if (this.shouldFocusTaskInput) {
      this.shouldFocusTaskInput = false;
      const input = inputEl.querySelector(
        ".zen-todo-text-input",
      ) as HTMLInputElement;
      if (input) setTimeout(() => input.focus(), 0);
    }

    const toolbarEl = el.createDiv({ cls: "zen-todo-toolbar" });
    this.renderSortSelector(toolbarEl);

    const sortKey = this.getCurrentSortKey();
    const sortDirection = this.getCurrentSortDirection();
    const contentDiv = el.createDiv({ cls: "zen-todo-content" });
    const incomplete = sortTasks(activeList.tasks.filter((t) => !t.completed), sortKey, sortDirection);
    const complete = sortTasks(activeList.tasks.filter((t) => t.completed), sortKey, sortDirection);

    renderTaskSection(
      contentDiv,
      incomplete,
      complete,
      this.settings.showCompletedByDefault,
      (event) => this.handleTaskAction(activeList, event),
      () => this.archiveAllCompleted(activeList),
      {
        addingSubtaskFor: this.addingSubtaskFor,
        onSubtaskSubmit: (parentTask, text) =>
          this.addSubtask(activeList, parentTask, text),
        onSubtaskCancel: () => {
          this.addingSubtaskFor = null;
          this.render();
        },
        onReorder: sortKey === "manual"
          ? (orderedIds, parentTask) =>
              this.reorderTasks(activeList, orderedIds, parentTask)
          : undefined,
        onDragStateChange: (dragging) => {
          this.isDragging = dragging;
        },
        onNest: sortKey === "manual"
          ? (draggedTaskId, targetTaskId) =>
              this.reparentTask(activeList, draggedTaskId, targetTaskId)
          : undefined,
        onUnnest: sortKey === "manual"
          ? (taskId, dropIndex) => this.unparentTask(activeList, taskId, dropIndex)
          : undefined,
        app: this.app,
        sourcePath: activeList.filePath,
        moveTargets: this.getMoveTargets(activeList.filePath),
      },
    );

    this.renderUndoToast(el);
  }

  private renderAllView(el: HTMLElement): void {
    if (this.lists.length === 0) {
      const contentDiv = el.createDiv({ cls: "zen-todo-content" });
      contentDiv.createDiv({
        cls: "zen-todo-empty",
        text: t("noLists.message"),
      });
      return;
    }

    // Clean up stale exclusions (files that no longer exist)
    const validPaths = new Set(this.lists.map((l) => l.filePath));
    const cleanedExclusions = this.settings.excludedFromAll.filter((p) => validPaths.has(p));
    if (cleanedExclusions.length !== this.settings.excludedFromAll.length) {
      this.settings.excludedFromAll = cleanedExclusions;
      this._saveSettings();
    }

    const visibleLists = this.lists.filter(
      (l) => !this.settings.excludedFromAll.includes(l.filePath),
    );

    // Toolbar row: filter button
    const toolbarEl = el.createDiv({ cls: "zen-todo-toolbar zen-todo-toolbar--all-filter" });
    this.renderAllViewFilter(toolbarEl);

    // Task input with list selector (using visibleLists for default target)
    const inputEl = el.createDiv({ cls: "zen-todo-input-wrapper" });
    const inputLists = visibleLists.length > 0 ? visibleLists : this.lists;
    renderTaskInput(
      inputEl,
      (text, dueDate, targetFilePath) => {
        const list = targetFilePath
          ? this.lists.find((l) => l.filePath === targetFilePath)
          : inputLists[0];
        if (list) this.addTask(list, text, dueDate);
      },
      inputLists.map((l) => ({ filePath: l.filePath, title: l.title })),
      this.allViewSelectedList,
      (fp) => { this.allViewSelectedList = fp; },
      (controls) => {
        this.renderAllViewFilter(controls, "zen-todo-filter-wrapper--inline");
      },
    );
    if (this.shouldFocusTaskInput) {
      this.shouldFocusTaskInput = false;
      const input = inputEl.querySelector(".zen-todo-text-input") as HTMLInputElement;
      if (input) setTimeout(() => input.focus(), 0);
    }

    if (visibleLists.length === 0 && this.lists.length > 0) {
      const contentDiv = el.createDiv({ cls: "zen-todo-content" });
      contentDiv.createDiv({
        cls: "zen-todo-empty",
        text: t("allView.allHidden"),
      });
      return;
    }

    const contentDiv = el.createDiv({ cls: "zen-todo-content" });
    const groupMeta: { filePath: string; groupEl: HTMLElement; list: TodoList }[] = [];
    const sortKey = this.getCurrentSortKey();
    const sortDirection = this.getCurrentSortDirection();

    // Pass 1: Build DOM for each list group (onReorder suppressed — cross-list handler takes over)
    for (const list of visibleLists) {
      const groupEl = contentDiv.createDiv({ cls: "zen-todo-all-group" });
      groupMeta.push({ filePath: list.filePath, groupEl, list });

      // Group header — click to navigate to that list
      const headerEl = groupEl.createDiv({ cls: "zen-todo-all-group-header" });
      headerEl.createSpan({
        cls: "zen-todo-all-group-title",
        text: list.title,
      });
      headerEl.addEventListener("click", () => {
        this.activeFilePath = list.filePath;
        this.addingSubtaskFor = null;
        this.activeSortKey = null;
        this.activeSortDirection = null;
        this.allViewSelectedList = null;
        this.render();
      });

      if (list.description) {
        groupEl.createDiv({
          cls: "zen-todo-all-group-description",
          text: list.description,
        });
      }

      const incomplete = sortTasks(list.tasks.filter((t) => !t.completed), sortKey, sortDirection);

      renderTaskSection(
        groupEl,
        incomplete,
        [],                // Allタブでは完了タスクを非表示
        false,
        (event) => this.handleTaskAction(list, event),
        undefined,         // アーカイブボタンも不要
        {
          addingSubtaskFor: this.addingSubtaskFor,
          onSubtaskSubmit: (parentTask, text) =>
            this.addSubtask(list, parentTask, text),
          onSubtaskCancel: () => {
            this.addingSubtaskFor = null;
            this.render();
          },
          // サブタスクにのみドラッグハンドルを付与（ルートはcross-listハンドルを使う）
          ...(sortKey === "manual" ? {
            onReorder: (orderedIds: string[], parentTask?: TaskItem) => this.reorderTasks(list, orderedIds, parentTask),
            onDragStateChange: (dragging: boolean) => { this.isDragging = dragging; },
            onUnnest: (taskId: string, dropIndex: number) => this.unparentTask(list, taskId, dropIndex),
          } : {}),
          subtaskDragOnly: true,
          app: this.app,
          sourcePath: list.filePath,
          moveTargets: this.getMoveTargets(list.filePath),
        },
      );
    }

    // Pass 2: Attach cross-list drag handles to root task items (manual sort only)
    if (sortKey !== "manual") return;

    const listGroups: ListGroupInfo[] = groupMeta.map(({ filePath, groupEl }) => ({
      filePath,
      groupEl,
    }));

    for (const { filePath, groupEl } of groupMeta) {
      const incSection = groupEl.querySelector(".zen-todo-incomplete-section") as HTMLElement | null;
      const cmpSection = groupEl.querySelector(".zen-todo-completed-section") as HTMLElement | null;

      const rootTaskItems: HTMLElement[] = [];
      if (incSection) {
        rootTaskItems.push(
          ...(Array.from(incSection.querySelectorAll(":scope > .zen-todo-task-item")) as HTMLElement[]),
        );
      }
      if (cmpSection) {
        rootTaskItems.push(
          ...(Array.from(cmpSection.querySelectorAll(":scope > .zen-todo-task-item")) as HTMLElement[]),
        );
      }

      for (const taskItemEl of rootTaskItems) {
        const taskRowEl = taskItemEl.querySelector(".zen-todo-task-row") as HTMLElement | null;
        if (!taskRowEl) continue;

        attachCrossListDragHandle(
          taskItemEl,
          taskRowEl,
          filePath,
          contentDiv,
          listGroups,
          {
            onReorder: (orderedIds, sourceFilePath) => {
              const sourceList = this.lists.find((l) => l.filePath === sourceFilePath);
              if (sourceList) this.reorderTasks(sourceList, orderedIds);
            },
            onMove: (taskId, sourceFilePath, targetFilePath, dropIndex) => {
              const sourceList = this.lists.find((l) => l.filePath === sourceFilePath);
              const task = sourceList?.tasks.find((t) => t.id === taskId);
              if (sourceList && task) {
                this.moveTaskAtIndex(sourceList, task, targetFilePath, dropIndex);
              }
            },
            onDragStateChange: (dragging) => {
              this.isDragging = dragging;
            },
          },
        );
      }
    }
  }

  private renderAllViewFilter(el: HTMLElement, extraWrapperClass?: string): void {
    const wrapper = el.createDiv({
      cls: extraWrapperClass
        ? `zen-todo-filter-wrapper ${extraWrapperClass}`
        : "zen-todo-filter-wrapper",
    });
    const btn = wrapper.createEl("button", {
      cls: "zen-todo-filter-btn clickable-icon",
      attr: { "aria-label": t("allView.filterLists") },
    });
    if (this.settings.excludedFromAll.length > 0) {
      btn.classList.add("is-filtering");
    }
    setIcon(btn, "filter");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleFilterDropdown(wrapper);
    });
  }

  private toggleFilterDropdown(wrapper: HTMLElement): void {
    const existing = wrapper.querySelector(".zen-todo-filter-dropdown");
    if (existing) {
      existing.remove();
      this.render();
      return;
    }

    const dropdown = wrapper.createDiv({ cls: "zen-todo-filter-dropdown" });

    // ドロップダウン内クリックの伝播停止（外部クリックハンドラの誤発火防止）
    dropdown.addEventListener("click", (e) => e.stopPropagation());

    for (const list of this.lists) {
      const isExcluded = this.settings.excludedFromAll.includes(list.filePath);
      const row = dropdown.createDiv({ cls: "zen-todo-filter-row" });
      const cb = row.createEl("input", {
        type: "checkbox",
        attr: { id: `zen-filter-${list.filePath}` },
      });
      cb.checked = !isExcluded;
      row.createEl("label", {
        text: list.title,
        attr: { for: `zen-filter-${list.filePath}` },
      });
      cb.addEventListener("change", () => {
        if (cb.checked) {
          this.settings.excludedFromAll = this.settings.excludedFromAll.filter(
            (p) => p !== list.filePath,
          );
        } else {
          if (!this.settings.excludedFromAll.includes(list.filePath)) {
            this.settings.excludedFromAll.push(list.filePath);
          }
        }
        this._saveSettings();
      });
    }

    // Close on outside click → render で反映
    setTimeout(() => {
      document.addEventListener(
        "click",
        () => {
          dropdown.remove();
          this.render();
        },
        { once: true },
      );
    }, 0);
  }

  private async handleTaskAction(
    list: TodoList,
    event: TaskActionEvent,
  ): Promise<void> {
    switch (event.action) {
      case "toggle":
        await this.toggleTask(list, event.task, event.parentTask);
        break;
      case "delete":
        await this.deleteTask(list, event.task, event.parentTask);
        break;
      case "edit":
        if (event.value !== undefined) {
          await this.editTask(list, event.task, event.value);
        }
        break;
      case "add-subtask":
        this.addingSubtaskFor = event.task.id;
        this.render();
        break;
      case "set-due":
        await this.setDueDate(list, event.task, event.value, event.parentTask);
        break;
      case "archive":
        await this.archiveTask(list, event.task);
        break;
      case "insert-link":
        this.insertLink(list, event.task);
        break;
      case "remove-link":
        await this.removeLink(list, event.task);
        break;
      case "move":
        if (event.targetFilePath) {
          await this.moveTask(list, event.task, event.targetFilePath);
        }
        break;
    }
  }

  private async moveTask(
    sourceList: TodoList,
    task: TaskItem,
    targetFilePath: string,
  ): Promise<void> {
    const targetList = this.lists.find((l) => l.filePath === targetFilePath);
    if (!targetList) return;

    this.captureUndo("move", t("undo.moved", { name: task.text }), [
      sourceList,
      targetList,
    ]);

    // Remove from source
    sourceList.tasks = sourceList.tasks.filter((tsk) => tsk.id !== task.id);

    // Add to target
    targetList.tasks.push(task);

    // Save both lists
    this.isSaving = true;
    try {
      const sourceFile = this.app.vault.getAbstractFileByPath(sourceList.filePath);
      const targetFile = this.app.vault.getAbstractFileByPath(targetList.filePath);
      if (sourceFile instanceof TFile) {
        const srcContent = serializeToMarkdown(
          sourceList.title,
          sourceList.tasks,
          sourceList.archivedSection,
          sourceList.description,
        );
        await this.app.vault.process(sourceFile, () => srcContent);
      }
      if (targetFile instanceof TFile) {
        const tgtContent = serializeToMarkdown(
          targetList.title,
          targetList.tasks,
          targetList.archivedSection,
          targetList.description,
        );
        await this.app.vault.process(targetFile, () => tgtContent);
      }
    } finally {
      this.isSaving = false;
    }
    this.render();
  }

  private async moveTaskAtIndex(
    sourceList: TodoList,
    task: TaskItem,
    targetFilePath: string,
    dropIndex: number,
  ): Promise<void> {
    const targetList = this.lists.find((l) => l.filePath === targetFilePath);
    if (!targetList) return;

    this.captureUndo("move", t("undo.moved", { name: task.text }), [
      sourceList,
      targetList,
    ]);

    // Remove from source
    sourceList.tasks = sourceList.tasks.filter((tsk) => tsk.id !== task.id);

    // Insert into target at dropIndex within same-status group
    const isCompleted = task.completed;
    const incomplete = targetList.tasks.filter((t) => !t.completed);
    const completed = targetList.tasks.filter((t) => t.completed);

    if (isCompleted) {
      const clampedIndex = Math.min(dropIndex, completed.length);
      completed.splice(clampedIndex, 0, task);
    } else {
      const clampedIndex = Math.min(dropIndex, incomplete.length);
      incomplete.splice(clampedIndex, 0, task);
    }
    targetList.tasks = [...incomplete, ...completed];

    // Save both lists
    this.isSaving = true;
    try {
      const sourceFile = this.app.vault.getAbstractFileByPath(sourceList.filePath);
      const targetFile = this.app.vault.getAbstractFileByPath(targetList.filePath);
      if (sourceFile instanceof TFile) {
        const srcContent = serializeToMarkdown(
          sourceList.title,
          sourceList.tasks,
          sourceList.archivedSection,
          sourceList.description,
        );
        await this.app.vault.process(sourceFile, () => srcContent);
      }
      if (targetFile instanceof TFile) {
        const tgtContent = serializeToMarkdown(
          targetList.title,
          targetList.tasks,
          targetList.archivedSection,
          targetList.description,
        );
        await this.app.vault.process(targetFile, () => tgtContent);
      }
    } finally {
      this.isSaving = false;
    }
    this.render();
  }

  private async insertLink(list: TodoList, task: TaskItem): Promise<void> {
    if (task.text.includes("[[")) return;
    const folder = this.app.fileManager.getNewFileParent(list.filePath);
    const folderPath = folder.path === "/" ? "" : folder.path;
    const filePath = normalizePath(
      folderPath ? `${folderPath}/${task.text}.md` : `${task.text}.md`,
    );
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (!(existing instanceof TFile)) {
      await this.app.vault.create(filePath, "");
    }
    task.text = `[[${task.text}]]`;
    await this.saveList(list);
  }

  private async removeLink(list: TodoList, task: TaskItem): Promise<void> {
    const linkMatch = task.text.match(/^\[\[([^\]]+)\]\]$/);
    if (!linkMatch) return;
    const linkTarget = linkMatch[1];

    const confirmed = await new Promise<boolean>((resolve) => {
      const modal = new ConfirmModal(
        this.app,
        t("modal.removeLink.title"),
        t("modal.removeLink.message", { name: linkTarget }),
        t("modal.removeLink.confirm"),
        t("modal.removeLink.cancel"),
        resolve,
      );
      modal.open();
    });
    if (!confirmed) return;

    const file = this.app.metadataCache.getFirstLinkpathDest(linkTarget, list.filePath);
    if (file instanceof TFile) {
      await this.app.vault.trash(file, true);
    }
    task.text = linkTarget;
    await this.saveList(list);
  }

  private async addTask(
    list: TodoList,
    text: string,
    dueDate?: string,
  ): Promise<void> {
    list.tasks.push(createTask(text, dueDate));
    this.shouldFocusTaskInput = true;
    await this.saveList(list);
  }

  private async addSubtask(
    list: TodoList,
    parentTask: TaskItem,
    text: string,
  ): Promise<void> {
    const subtask = createTask(text);
    subtask.indentLevel = parentTask.indentLevel + 1;
    parentTask.subtasks.push(subtask);
    await this.saveList(list);
  }

  private async toggleTask(
    list: TodoList,
    task: TaskItem,
    parentTask?: TaskItem,
  ): Promise<void> {
    const desc = task.completed
      ? t("undo.uncompleted", { name: task.text })
      : t("undo.completed", { name: task.text });
    this.captureUndo("toggle", desc, [list]);
    const updated = task.completed ? uncompleteTask(task) : completeTask(task);
    Object.assign(task, updated);

    if (parentTask && this.settings.autoCompleteParent) {
      if (!task.completed && parentTask.completed) {
        Object.assign(parentTask, uncompleteTask(parentTask));
      } else if (
        task.completed &&
        allSubtasksCompleted(parentTask) &&
        !parentTask.completed
      ) {
        Object.assign(parentTask, completeTask(parentTask));
      }
    }

    await this.saveList(list);
  }

  private async deleteTask(
    list: TodoList,
    task: TaskItem,
    parentTask?: TaskItem,
  ): Promise<void> {
    this.captureUndo("delete", t("undo.deleted", { name: task.text }), [list]);
    if (parentTask) {
      parentTask.subtasks = parentTask.subtasks.filter((t) => t.id !== task.id);
    } else {
      list.tasks = list.tasks.filter((t) => t.id !== task.id);
    }
    await this.saveList(list);
  }

  private async archiveTask(list: TodoList, task: TaskItem): Promise<void> {
    this.captureUndo("archive", t("undo.archived", { name: task.text }), [list]);
    const lines = serializeTaskToLines(task);
    const block = lines.join("\n");
    if (list.archivedSection) {
      list.archivedSection = list.archivedSection + "\n" + block;
    } else {
      list.archivedSection = "## Archived\n\n" + block;
    }
    list.tasks = list.tasks.filter((t) => t.id !== task.id);
    await this.saveList(list);
  }

  private async archiveAllCompleted(list: TodoList): Promise<void> {
    const completed = list.tasks.filter((t) => t.completed);
    if (completed.length === 0) return;
    this.captureUndo(
      "archiveAllCompleted",
      t("undo.archivedAll", { count: completed.length }),
      [list],
    );
    const block = completed.flatMap((t) => serializeTaskToLines(t)).join("\n");
    if (list.archivedSection) {
      list.archivedSection = list.archivedSection + "\n" + block;
    } else {
      list.archivedSection = "## Archived\n\n" + block;
    }
    list.tasks = list.tasks.filter((t) => !t.completed);
    await this.saveList(list);
  }

  private async editTask(
    list: TodoList,
    task: TaskItem,
    newText: string,
  ): Promise<void> {
    const parsed = parseTaskInput(newText);
    const oldLink = task.text.match(/^\[\[([^\]]+)\]\]$/);
    const newLink = parsed.text.match(/^\[\[([^\]]+)\]\]$/);

    // リンク先が変わった場合、既存ファイルをリネーム
    if (oldLink && newLink && oldLink[1] !== newLink[1]) {
      const oldFile = this.app.metadataCache.getFirstLinkpathDest(
        oldLink[1],
        list.filePath,
      );
      if (oldFile instanceof TFile) {
        const newPath = normalizePath(
          `${oldFile.parent?.path ?? ""}/${newLink[1]}.md`,
        );
        const conflict = this.app.vault.getAbstractFileByPath(newPath);
        if (!conflict) {
          await this.app.vault.rename(oldFile, newPath);
        }
      }
    }

    task.text = parsed.text;
    task.tags = parsed.tags;
    await this.saveList(list);
  }

  private async setDueDate(
    list: TodoList,
    task: TaskItem,
    dueDate: string | undefined,
    _parentTask?: TaskItem,
  ): Promise<void> {
    task.dueDate = dueDate;
    await this.saveList(list);
  }

  private async reorderTasks(
    list: TodoList,
    orderedIds: string[],
    parentTask?: TaskItem,
  ): Promise<void> {
    const source = parentTask ? parentTask.subtasks : list.tasks;
    const idToTask = new Map(source.map((t) => [t.id, t]));
    const firstTask = idToTask.get(orderedIds[0]);
    if (!firstTask) return;
    const reorderedIsIncomplete = !firstTask.completed;

    const otherGroup = source.filter((t) =>
      reorderedIsIncomplete ? t.completed : !t.completed,
    );
    const reordered = orderedIds
      .map((id) => idToTask.get(id))
      .filter((t): t is TaskItem => t !== undefined);

    const newOrder = reorderedIsIncomplete
      ? [...reordered, ...otherGroup]
      : [...otherGroup, ...reordered];

    if (parentTask) {
      parentTask.subtasks = newOrder;
    } else {
      list.tasks = newOrder;
    }
    await this.saveList(list);
  }

  private async unparentTask(list: TodoList, taskId: string, dropIndex: number): Promise<void> {
    const task = findTaskInTree(list.tasks, taskId);
    if (!task) return;

    this.captureUndo("unparent", t("undo.unparented", { name: task.text }), [list]);

    removeTaskFromTree(list.tasks, taskId);
    task.indentLevel = 0;
    task.subtasks = [];

    // Insert at dropIndex within the same-status group
    const isCompleted = task.completed;
    const incomplete = list.tasks.filter((t) => !t.completed);
    const completed = list.tasks.filter((t) => t.completed);

    if (isCompleted) {
      const clampedIndex = Math.min(dropIndex, completed.length);
      completed.splice(clampedIndex, 0, task);
    } else {
      const clampedIndex = Math.min(dropIndex, incomplete.length);
      incomplete.splice(clampedIndex, 0, task);
    }
    list.tasks = [...incomplete, ...completed];

    await this.saveList(list);
  }

  private async reparentTask(
    list: TodoList,
    taskId: string,
    newParentTaskId: string,
  ): Promise<void> {
    const newParent = findTaskInTree(list.tasks, newParentTaskId);
    if (!newParent) return;

    const task = findTaskInTree(list.tasks, taskId);
    if (!task) return;

    // Safety check: if task itself has subtasks, nesting would exceed depth limit
    if (task.subtasks.length > 0) return;

    // Capture undo BEFORE mutating
    this.captureUndo("reparent", t("undo.reparented", { name: task.text }), [list]);

    // Remove the task from wherever it currently lives
    removeTaskFromTree(list.tasks, taskId);

    task.indentLevel = newParent.indentLevel + 1;
    newParent.subtasks.push(task);

    await this.saveList(list);
  }

  private async saveList(list: TodoList): Promise<void> {
    const abstract = this.app.vault.getAbstractFileByPath(list.filePath);
    if (!(abstract instanceof TFile)) return;

    const content = serializeToMarkdown(
      list.title,
      list.tasks,
      list.archivedSection,
      list.description,
    );
    this.isSaving = true;
    try {
      await this.app.vault.process(abstract, () => content);
    } finally {
      this.isSaving = false;
    }
    this.render();
  }

  // ------------------------------------------------------------------ //
  // Undo toast
  // ------------------------------------------------------------------ //

  private captureUndo(
    actionType: UndoActionType,
    description: string,
    listsToSnapshot: TodoList[],
  ): void {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }

    const snapshots: ListSnapshot[] = listsToSnapshot.map((list) => ({
      filePath: list.filePath,
      tasks: cloneTasks(list.tasks),
      archivedSection: list.archivedSection,
    }));

    this.undoState = {
      actionType,
      description,
      snapshots,
      timestamp: Date.now(),
    };

    this.undoTimer = setTimeout(() => {
      this.undoState = null;
      this.undoTimer = null;
      this.render();
    }, 5000);
  }

  private clearUndo(): void {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    this.undoState = null;
  }

  private async performUndo(): Promise<void> {
    if (!this.undoState) return;

    const { snapshots } = this.undoState;
    this.clearUndo();

    this.isSaving = true;
    try {
      for (const snapshot of snapshots) {
        const list = this.lists.find((l) => l.filePath === snapshot.filePath);
        if (!list) continue;

        list.tasks = snapshot.tasks;
        list.archivedSection = snapshot.archivedSection;

        const abstract = this.app.vault.getAbstractFileByPath(list.filePath);
        if (abstract instanceof TFile) {
          const content = serializeToMarkdown(
            list.title,
            list.tasks,
            list.archivedSection,
            list.description,
          );
          await this.app.vault.process(abstract, () => content);
        }
      }
    } finally {
      this.isSaving = false;
    }

    this.render();
  }

  private renderSortSelector(el: HTMLElement): void {
    const wrapper = el.createDiv({ cls: "zen-todo-sort-wrapper" });
    wrapper.createSpan({ cls: "zen-todo-sort-label", text: t("sort.label") });

    const select = wrapper.createEl("select", {
      cls: "zen-todo-sort-select",
      attr: { "aria-label": t("sort.ariaLabel") },
    });

    const options: { value: SortKey; label: string }[] = [
      { value: "manual", label: t("sort.manual") },
      { value: "dueDate", label: t("sort.dueDate") },
      { value: "createdDate", label: t("sort.createdDate") },
      { value: "alphabetical", label: t("sort.alphabetical") },
    ];

    const current = this.getCurrentSortKey();
    for (const opt of options) {
      const optEl = select.createEl("option", { value: opt.value, text: opt.label });
      if (opt.value === current) optEl.selected = true;
    }

    select.addEventListener("change", () => {
      this.activeSortKey = select.value as SortKey;
      this.activeSortDirection = null;
      this.render();
    });

    const direction = this.getCurrentSortDirection();
    const dirBtn = wrapper.createEl("button", {
      cls: "zen-todo-sort-direction-btn",
      attr: {
        "aria-label": direction === "asc" ? t("sort.ascending") : t("sort.descending"),
      },
      text: direction === "asc" ? "↑" : "↓",
    });
    if (current === "manual") {
      dirBtn.addClass("is-hidden");
    }
    dirBtn.addEventListener("click", () => {
      this.activeSortDirection = this.getCurrentSortDirection() === "asc" ? "desc" : "asc";
      this.render();
    });
  }

  private renderUndoToast(el: HTMLElement): void {
    if (!this.undoState) return;

    const toast = el.createDiv({ cls: "zen-todo-undo-toast" });
    toast.createSpan({
      cls: "zen-todo-undo-message",
      text: this.undoState.description,
    });

    const undoBtn = toast.createEl("button", {
      cls: "zen-todo-undo-btn",
      text: t("undo.button"),
    });
    undoBtn.addEventListener("click", () => this.performUndo());
  }

  private renderDescription(el: HTMLElement, list: TodoList): void {
    if (list.description) {
      const textEl = el.createDiv({
        cls: "zen-todo-description-text",
        text: list.description,
      });
      textEl.addEventListener("click", () =>
        this.startDescriptionEdit(el, list),
      );
    } else {
      const addEl = el.createDiv({
        cls: "zen-todo-description-add",
        text: t("description.addPlaceholder"),
      });
      addEl.addEventListener("click", () =>
        this.startDescriptionEdit(el, list),
      );
    }
  }

  private startDescriptionEdit(el: HTMLElement, list: TodoList): void {
    el.empty();
    const textarea = el.createEl("textarea", {
      cls: "zen-todo-description-input",
    });
    textarea.value = list.description ?? "";
    let saved = false;

    const save = async () => {
      if (saved) return;
      saved = true;
      const newDesc = textarea.value.trim() || undefined;
      await this.updateDescription(list, newDesc);
    };

    textarea.addEventListener("blur", save);
    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        saved = true;
        this.render();
      }
    });

    setTimeout(() => textarea.focus(), 0);
  }

  private async updateDescription(
    list: TodoList,
    newDescription: string | undefined,
  ): Promise<void> {
    list.description = newDescription;
    await this.saveList(list);
  }
}

// ------------------------------------------------------------------ //
// New list modal
// ------------------------------------------------------------------ //

class NewListModal extends Modal {
  private onSubmit: (name: string) => void;

  constructor(app: App, onSubmit: (name: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: t("modal.newList.title") });

    const input = contentEl.createEl("input", {
      type: "text",
      cls: "zen-todo-modal-input",
      attr: {
        placeholder: t("modal.newList.placeholder"),
        "aria-label": t("modal.newList.ariaLabel"),
      },
    });

    const submitBtn = contentEl.createEl("button", {
      cls: "mod-cta",
      text: t("modal.newList.submit"),
    });

    const submit = () => {
      const name = input.value.trim();
      if (!name) return;
      this.close();
      this.onSubmit(name);
    };

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) submit();
    });
    submitBtn.addEventListener("click", submit);

    setTimeout(() => input.focus(), 50);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ------------------------------------------------------------------ //
// Confirm modal
// ------------------------------------------------------------------ //

class ConfirmModal extends Modal {
  private title: string;
  private message: string;
  private confirmLabel: string;
  private cancelLabel: string;
  private resolve: (value: boolean) => void;
  private resolved = false;

  constructor(
    app: App,
    title: string,
    message: string,
    confirmLabel: string,
    cancelLabel: string,
    resolve: (value: boolean) => void,
  ) {
    super(app);
    this.title = title;
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.cancelLabel = cancelLabel;
    this.resolve = resolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    const btnContainer = contentEl.createDiv({ cls: "modal-button-container" });
    btnContainer.createEl("button", { text: this.cancelLabel }).addEventListener("click", () => {
      this.resolved = true;
      this.resolve(false);
      this.close();
    });
    const confirmBtn = btnContainer.createEl("button", { cls: "mod-warning", text: this.confirmLabel });
    confirmBtn.addEventListener("click", () => {
      this.resolved = true;
      this.resolve(true);
      this.close();
    });
  }

  onClose(): void {
    if (!this.resolved) this.resolve(false);
    this.contentEl.empty();
  }
}
