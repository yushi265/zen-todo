import { MarkdownRenderChild, TFile, normalizePath } from "obsidian";
import { ZenTodoController } from "./todo-controller";
import type ZenTodoPlugin from "../main";
import type { TodoList, TaskItem } from "../types";
import { parseMarkdown } from "../parser/markdown-parser";
import { serializeToMarkdown } from "../parser/markdown-serializer";
import { parseQuery } from "../query/query-parser";
import { ALL_LISTS_PATH } from "../constants";
import { executeQuery } from "../query/query-engine";
import { renderQueryView } from "./query-view-renderer";
import { completeTask, uncompleteTask } from "../models/task";

export class ZenTodoCodeBlockChild extends MarkdownRenderChild {
  private controller: ZenTodoController | null = null;
  private plugin: ZenTodoPlugin;
  private source: string;

  // Query mode state
  private isQueryMode = false;
  private lists: TodoList[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private isSaving = false;
  private innerEl: HTMLElement | null = null;

  constructor(
    containerEl: HTMLElement,
    plugin: ZenTodoPlugin,
    source: string,
  ) {
    super(containerEl);
    this.plugin = plugin;
    this.source = source;
  }

  async onload(): Promise<void> {
    this.containerEl.addClass("zen-todo-view", "zen-todo-embedded");

    const innerEl = this.containerEl.createDiv();
    this.innerEl = innerEl;

    const isViewAll = /^view:\s*all$/i.test(this.source.trim());
    const { query, errors } = isViewAll ? { query: null, errors: [] } : parseQuery(this.source);

    if (query === null) {
      // Empty source or "view: all" → full interactive panel
      this.isQueryMode = false;
      this.controller = new ZenTodoController(
        {
          app: this.plugin.app,
          settings: this.plugin.settings,
          saveSettings: () => this.plugin.saveSettings(),
        },
        innerEl,
        () => this.controller?.createNewList(),
      );
      if (isViewAll) {
        this.controller.activeFilePath = ALL_LISTS_PATH;
      }
      await this.controller.initialize();
    } else {
      // Query mode
      this.isQueryMode = true;
      await this.loadLists();
      this.renderQuery(query, errors);
    }

    this.plugin.registerEmbeddedController(this);
  }

  onunload(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.controller?.destroy();
    this.controller = null;
    this.innerEl = null;
    this.plugin.unregisterEmbeddedController(this);
  }

  /** Re-render immediately (e.g. after a language change). */
  forceRender(): void {
    if (this.isQueryMode) {
      const { query, errors } = parseQuery(this.source);
      if (query) this.renderQuery(query, errors);
    } else {
      this.controller?.render();
    }
  }

  onExternalChange(_filePath: string): void {
    if (!this.isQueryMode) {
      this.controller?.onExternalChange(_filePath);
      return;
    }
    if (this.isSaving) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      await this.loadLists();
      const { query, errors } = parseQuery(this.source);
      if (query) this.renderQuery(query, errors);
    }, 300);
  }

  // ------------------------------------------------------------------ //
  // Query mode helpers
  // ------------------------------------------------------------------ //

  private async loadLists(): Promise<void> {
    const folder = normalizePath(this.plugin.settings.todoFolder);
    const files = this.plugin.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(folder + "/") && f.extension === "md");

    this.lists = await Promise.all(
      files.map(async (file) => {
        const content = await this.plugin.app.vault.read(file);
        const { title, description, tasks, archivedSection } = parseMarkdown(content);
        return { filePath: file.path, title, description, tasks, archivedSection };
      }),
    );
  }

  private renderQuery(
    query: ReturnType<typeof parseQuery>["query"],
    errors: string[],
  ): void {
    if (!query || !this.innerEl) return;
    const results = executeQuery(query, this.lists);
    renderQueryView(this.innerEl, {
      query,
      results,
      errors,
      app: this.plugin.app,
      sourcePath: "",
      onToggle: (task, listFilePath) => this.toggleTask(task, listFilePath),
    });
  }

  private async toggleTask(task: TaskItem, listFilePath: string): Promise<void> {
    const list = this.lists.find((l) => l.filePath === listFilePath);
    if (!list) return;

    // Mutate task in-memory (find root or subtask)
    const updated = task.completed ? uncompleteTask(task) : completeTask(task);
    Object.assign(task, updated);

    // Save to vault
    const abstract = this.plugin.app.vault.getAbstractFileByPath(listFilePath);
    if (!(abstract instanceof TFile)) return;

    const content = serializeToMarkdown(list.title, list.tasks, list.archivedSection, list.description);
    this.isSaving = true;
    try {
      await this.plugin.app.vault.process(abstract, () => content);
    } finally {
      this.isSaving = false;
    }

    // Re-render with updated state
    const { query, errors } = parseQuery(this.source);
    if (query) this.renderQuery(query, errors);
  }
}
