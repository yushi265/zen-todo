import { App, TFile, Modal, normalizePath } from "obsidian";
import type { TodoList, TaskItem, ZenTodoSettings } from "../types";
import { parseMarkdown } from "../parser/markdown-parser";
import { serializeToMarkdown, serializeTaskToLines } from "../parser/markdown-serializer";
import { renderListSelector } from "./list-selector";
import { renderTaskInput } from "./task-input";
import { renderTaskSection } from "./task-section";
import type { TaskActionEvent } from "./task-item-renderer";
import { createTask, completeTask, uncompleteTask, allSubtasksCompleted } from "../models/task";

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
		onCreateNew?: () => void
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
			})
		);

		this.sortListsByOrder();
		await this.reconcileListOrder();

		if (this.lists.length > 0) {
			const stillExists = this.lists.some((l) => l.filePath === this.activeFilePath);
			if (!stillExists) this.activeFilePath = this.lists[0].filePath;
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

	private getActiveList(): TodoList | null {
		if (!this.activeFilePath) return null;
		return this.lists.find((l) => l.filePath === this.activeFilePath) ?? null;
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
			(orderedFilePaths) => this.reorderLists(orderedFilePaths)
		);

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
		renderTaskInput(inputEl, (text, dueDate) => this.addTask(activeList, text, dueDate));
		if (this.shouldFocusTaskInput) {
			this.shouldFocusTaskInput = false;
			const input = inputEl.querySelector(".zen-todo-text-input") as HTMLInputElement;
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
			}
		);
	}

	private async handleTaskAction(list: TodoList, event: TaskActionEvent): Promise<void> {
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
		}
	}

	private async addTask(list: TodoList, text: string, dueDate?: string): Promise<void> {
		list.tasks.push(createTask(text, dueDate));
		this.shouldFocusTaskInput = true;
		await this.saveList(list);
	}

	private async addSubtask(
		list: TodoList,
		parentTask: TaskItem,
		text: string
	): Promise<void> {
		const subtask = createTask(text);
		subtask.indentLevel = parentTask.indentLevel + 1;
		parentTask.subtasks.push(subtask);
		await this.saveList(list);
	}

	private async toggleTask(
		list: TodoList,
		task: TaskItem,
		parentTask?: TaskItem
	): Promise<void> {
		const updated = task.completed ? uncompleteTask(task) : completeTask(task);
		Object.assign(task, updated);

		if (parentTask && this.settings.autoCompleteParent) {
			if (!task.completed && parentTask.completed) {
				Object.assign(parentTask, uncompleteTask(parentTask));
			} else if (task.completed && allSubtasksCompleted(parentTask) && !parentTask.completed) {
				Object.assign(parentTask, completeTask(parentTask));
			}
		}

		await this.saveList(list);
	}

	private async deleteTask(
		list: TodoList,
		task: TaskItem,
		parentTask?: TaskItem
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

	private async editTask(list: TodoList, task: TaskItem, newText: string): Promise<void> {
		task.text = newText;
		await this.saveList(list);
	}

	private async saveNotes(list: TodoList, task: TaskItem, notes: string): Promise<void> {
		task.notes = notes.trim() || undefined;
		this.editingNotesFor = null;
		await this.saveList(list);
	}

	private async setDueDate(
		list: TodoList,
		task: TaskItem,
		dueDate: string | undefined,
		_parentTask?: TaskItem
	): Promise<void> {
		task.dueDate = dueDate;
		await this.saveList(list);
	}

	private async reorderTasks(
		list: TodoList,
		orderedIds: string[],
		parentTask?: TaskItem
	): Promise<void> {
		const source = parentTask ? parentTask.subtasks : list.tasks;
		const idToTask = new Map(source.map((t) => [t.id, t]));
		const firstTask = idToTask.get(orderedIds[0]);
		if (!firstTask) return;
		const reorderedIsIncomplete = !firstTask.completed;

		const otherGroup = source.filter((t) =>
			reorderedIsIncomplete ? t.completed : !t.completed
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

		const content = serializeToMarkdown(list.title, list.tasks, list.archivedSection);
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
