import { Plugin, WorkspaceLeaf, normalizePath } from "obsidian";
import type { ZenTodoSettings } from "./types";
import { DEFAULT_SETTINGS, VIEW_TYPE_ZEN_TODO } from "./constants";
import { ZenTodoSettingTab } from "./settings";
import { ZenTodoView } from "./views/todo-view";

export default class ZenTodoPlugin extends Plugin {
	settings: ZenTodoSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_ZEN_TODO,
			(leaf) => new ZenTodoView(leaf, this)
		);

		this.addRibbonIcon("check-square", "Open ZenTodo", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-todo-list",
			name: "Open todo list",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "create-new-list",
			name: "Create new todo list",
			callback: async () => {
				await this.activateView();
				const view = this.getView();
				if (view) await view.createNewList();
			},
		});

		this.addSettingTab(new ZenTodoSettingTab(this.app, this));

		// Watch for file changes in the configured todo folder
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (this.isTodoFile(file.path)) this.notifyViews(file.path);
			})
		);
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (this.isTodoFile(file.path)) this.notifyViews(file.path);
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.isTodoFile(file.path)) this.notifyViews(file.path);
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (this.isTodoFile(file.path) || this.isTodoFile(oldPath)) {
					this.notifyViews(file.path);
				}
			})
		);
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_ZEN_TODO);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	// ------------------------------------------------------------------ //
	// Private helpers
	// ------------------------------------------------------------------ //

	private isTodoFile(filePath: string): boolean {
		const folder = normalizePath(this.settings.todoFolder);
		return filePath.startsWith(folder + "/") && filePath.endsWith(".md");
	}

	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_ZEN_TODO);
		if (leaves.length > 0) {
			workspace.revealLeaf(leaves[0]);
			return;
		}
		const leaf: WorkspaceLeaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_ZEN_TODO, active: true });
		workspace.revealLeaf(leaf);
	}

	/** Get the active view without storing a long-lived reference. */
	private getView(): ZenTodoView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_ZEN_TODO);
		if (leaves.length === 0) return null;
		const view = leaves[0].view;
		return view instanceof ZenTodoView ? view : null;
	}

	private notifyViews(filePath: string): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ZEN_TODO)) {
			if (leaf.view instanceof ZenTodoView) {
				leaf.view.onExternalChange(filePath);
			}
		}
	}
}
