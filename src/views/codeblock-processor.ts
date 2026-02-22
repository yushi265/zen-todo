import { MarkdownRenderChild } from "obsidian";
import { ZenTodoController } from "./todo-controller";
import type ZenTodoPlugin from "../main";

export class ZenTodoCodeBlockChild extends MarkdownRenderChild {
  private controller: ZenTodoController | null = null;
  private plugin: ZenTodoPlugin;

  constructor(
    containerEl: HTMLElement,
    plugin: ZenTodoPlugin,
    _source: string,
  ) {
    super(containerEl);
    this.plugin = plugin;
  }

  async onload(): Promise<void> {
    this.containerEl.addClass("zen-todo-view", "zen-todo-embedded");

    // innerEl: controller の render() で empty() される範囲をここに限定
    const innerEl = this.containerEl.createDiv();

    this.controller = new ZenTodoController(
      {
        app: this.plugin.app,
        settings: this.plugin.settings,
        saveSettings: () => this.plugin.saveSettings(),
      },
      innerEl,
      () => this.controller?.createNewList(),
    );
    await this.controller.initialize();
    this.plugin.registerEmbeddedController(this);
  }

  onunload(): void {
    this.controller?.destroy();
    this.controller = null;
    this.plugin.unregisterEmbeddedController(this);
  }

  onExternalChange(filePath: string): void {
    this.controller?.onExternalChange(filePath);
  }
}
