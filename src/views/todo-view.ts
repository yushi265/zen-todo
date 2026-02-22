import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_ZEN_TODO } from "../constants";
import { ZenTodoController } from "./todo-controller";
import type ZenTodoPlugin from "../main";

export class ZenTodoView extends ItemView {
	private plugin: ZenTodoPlugin;
	private controller: ZenTodoController | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ZenTodoPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ZEN_TODO;
	}

	getDisplayText(): string {
		return "ZenTodo";
	}

	getIcon(): string {
		return "check-square";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("zen-todo-view");
		this.controller = new ZenTodoController(
			{
				app: this.app,
				settings: this.plugin.settings,
				saveSettings: () => this.plugin.saveSettings(),
			},
			this.contentEl,
			() => this.createNewList()
		);
		await this.controller.initialize();
	}

	async onClose(): Promise<void> {
		this.controller?.destroy();
		this.controller = null;
	}

	getState(): Record<string, unknown> {
		return { activeFilePath: this.controller?.activeFilePath ?? null };
	}

	async setState(state: Record<string, unknown>): Promise<void> {
		if (this.controller && typeof state.activeFilePath === "string") {
			this.controller.activeFilePath = state.activeFilePath;
		}
		await this.controller?.initialize();
	}

	/** Called by main.ts when a todo file changes externally. */
	onExternalChange(filePath: string): void {
		this.controller?.onExternalChange(filePath);
	}

	/** Public: opens the new-list modal (triggered by command). */
	async createNewList(): Promise<void> {
		await this.controller?.createNewList();
	}
}
