import { App, TFile, Modal, normalizePath } from "obsidian";
import type { TodoList, TaskItem, ZenTodoSettings } from "../types";
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
  private editingNotesFor: string | null = null;
  isSaving = false;
  private isDragging = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldFocusTaskInput = false;

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
  }

  /** Called when a todo file changes externally. */
  onExternalChange(_filePath: string): void {
    if (this.isSaving || this.isDragging) return;
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

    this.lists = await Promise.all(
      files.map(async (file) => {
        const content = await this.app.vault.read(file);
        const { title, tasks, archivedSection } = parseMarkdown(content);
        return { filePath: file.path, title, tasks, archivedSection };
      }),
    );

    this.sortListsByOrder();
    await this.reconcileListOrder();

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
        this.editingNotesFor = null;
        this.render();
      },
      this.onCreateNew,
      (orderedFilePaths) => this.reorderLists(orderedFilePaths),
      (filePath, newName) => this.renameList(filePath, newName),
    );

    // All view
    if (this.activeFilePath === ALL_LISTS_PATH) {
      this.renderAllView(el);
      return;
    }

    const activeList = this.getActiveList();
    if (!activeList) {
      const emptyEl = el.createDiv({ cls: "zen-todo-no-list" });
      emptyEl.createEl("p", { text: "No todo lists found." });
      emptyEl.createEl("p", {
        text: `Click + to create a list, or add .md files to ${this.settings.todoFolder}/`,
      });
      return;
    }

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

    const contentDiv = el.createDiv({ cls: "zen-todo-content" });
    const incomplete = activeList.tasks.filter((t) => !t.completed);
    const complete = activeList.tasks.filter((t) => t.completed);

    renderTaskSection(
      contentDiv,
      incomplete,
      complete,
      this.settings.showCompletedByDefault,
      (event) => this.handleTaskAction(activeList, event),
      () => this.archiveAllCompleted(activeList),
      {
        addingSubtaskFor: this.addingSubtaskFor,
        editingNotesFor: this.editingNotesFor,
        onSubtaskSubmit: (parentTask, text) =>
          this.addSubtask(activeList, parentTask, text),
        onSubtaskCancel: () => {
          this.addingSubtaskFor = null;
          this.render();
        },
        onNotesSubmit: (task, notes) => this.saveNotes(activeList, task, notes),
        onNotesCancel: () => {
          this.editingNotesFor = null;
          this.render();
        },
        onReorder: (orderedIds, parentTask) =>
          this.reorderTasks(activeList, orderedIds, parentTask),
        onDragStateChange: (dragging) => {
          this.isDragging = dragging;
        },
        app: this.app,
        sourcePath: activeList.filePath,
        moveTargets: this.getMoveTargets(activeList.filePath),
      },
    );
  }

  private renderAllView(el: HTMLElement): void {
    if (this.lists.length === 0) {
      const contentDiv = el.createDiv({ cls: "zen-todo-content" });
      contentDiv.createDiv({
        cls: "zen-todo-empty",
        text: "No todo lists found.",
      });
      return;
    }

    // Task input with list selector
    const inputEl = el.createDiv({ cls: "zen-todo-input-wrapper" });
    renderTaskInput(
      inputEl,
      (text, dueDate, targetFilePath) => {
        const list = targetFilePath
          ? this.lists.find((l) => l.filePath === targetFilePath)
          : this.lists[0];
        if (list) this.addTask(list, text, dueDate);
      },
      this.lists.map((l) => ({ filePath: l.filePath, title: l.title })),
    );
    if (this.shouldFocusTaskInput) {
      this.shouldFocusTaskInput = false;
      const input = inputEl.querySelector(".zen-todo-text-input") as HTMLInputElement;
      if (input) setTimeout(() => input.focus(), 0);
    }

    const contentDiv = el.createDiv({ cls: "zen-todo-content" });
    const groupMeta: { filePath: string; groupEl: HTMLElement; list: TodoList }[] = [];

    // Pass 1: Build DOM for each list group (onReorder suppressed — cross-list handler takes over)
    for (const list of this.lists) {
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
        this.editingNotesFor = null;
        this.render();
      });

      const incomplete = list.tasks.filter((t) => !t.completed);
      const complete = list.tasks.filter((t) => t.completed);

      renderTaskSection(
        groupEl,
        incomplete,
        complete,
        this.settings.showCompletedByDefault,
        (event) => this.handleTaskAction(list, event),
        () => this.archiveAllCompleted(list),
        {
          addingSubtaskFor: this.addingSubtaskFor,
          editingNotesFor: this.editingNotesFor,
          onSubtaskSubmit: (parentTask, text) =>
            this.addSubtask(list, parentTask, text),
          onSubtaskCancel: () => {
            this.addingSubtaskFor = null;
            this.render();
          },
          onNotesSubmit: (task, notes) => this.saveNotes(list, task, notes),
          onNotesCancel: () => {
            this.editingNotesFor = null;
            this.render();
          },
          // onReorder intentionally omitted — cross-list handler manages drag
          app: this.app,
          sourcePath: list.filePath,
          moveTargets: this.getMoveTargets(list.filePath),
        },
      );
    }

    // Pass 2: Attach cross-list drag handles to root task items
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
      case "edit-notes":
        this.editingNotesFor = event.task.id;
        this.render();
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

    // Remove from source
    sourceList.tasks = sourceList.tasks.filter((t) => t.id !== task.id);

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
        );
        await this.app.vault.process(sourceFile, () => srcContent);
      }
      if (targetFile instanceof TFile) {
        const tgtContent = serializeToMarkdown(
          targetList.title,
          targetList.tasks,
          targetList.archivedSection,
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

    // Remove from source
    sourceList.tasks = sourceList.tasks.filter((t) => t.id !== task.id);

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
        );
        await this.app.vault.process(sourceFile, () => srcContent);
      }
      if (targetFile instanceof TFile) {
        const tgtContent = serializeToMarkdown(
          targetList.title,
          targetList.tasks,
          targetList.archivedSection,
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
        "Remove link",
        `"${linkTarget}" のリンク先ノートをゴミ箱に移動し、リンクを解除しますか？`,
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
    if (parentTask) {
      parentTask.subtasks = parentTask.subtasks.filter((t) => t.id !== task.id);
    } else {
      list.tasks = list.tasks.filter((t) => t.id !== task.id);
    }
    await this.saveList(list);
  }

  private async archiveTask(list: TodoList, task: TaskItem): Promise<void> {
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
    const oldLink = task.text.match(/^\[\[([^\]]+)\]\]$/);
    const newLink = newText.match(/^\[\[([^\]]+)\]\]$/);

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

    task.text = newText;
    await this.saveList(list);
  }

  private async saveNotes(
    list: TodoList,
    task: TaskItem,
    notes: string,
  ): Promise<void> {
    task.notes = notes.trim() || undefined;
    this.editingNotesFor = null;
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

  private async saveList(list: TodoList): Promise<void> {
    const abstract = this.app.vault.getAbstractFileByPath(list.filePath);
    if (!(abstract instanceof TFile)) return;

    const content = serializeToMarkdown(
      list.title,
      list.tasks,
      list.archivedSection,
    );
    this.isSaving = true;
    try {
      await this.app.vault.process(abstract, () => content);
    } finally {
      this.isSaving = false;
    }
    this.render();
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
    contentEl.createEl("h2", { text: "Create new todo list" });

    const input = contentEl.createEl("input", {
      type: "text",
      cls: "zen-todo-modal-input",
      attr: {
        placeholder: "List name...",
        "aria-label": "List name",
      },
    });

    const submitBtn = contentEl.createEl("button", {
      cls: "mod-cta",
      text: "Create",
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
  private resolve: (value: boolean) => void;
  private resolved = false;

  constructor(app: App, title: string, message: string, resolve: (value: boolean) => void) {
    super(app);
    this.title = title;
    this.message = message;
    this.resolve = resolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    const btnContainer = contentEl.createDiv({ cls: "modal-button-container" });
    btnContainer.createEl("button", { text: "Cancel" }).addEventListener("click", () => {
      this.resolved = true;
      this.resolve(false);
      this.close();
    });
    const removeBtn = btnContainer.createEl("button", { cls: "mod-warning", text: "Remove" });
    removeBtn.addEventListener("click", () => {
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
