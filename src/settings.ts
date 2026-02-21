import { App, PluginSettingTab, Setting } from "obsidian";
import type ZenTodoPlugin from "./main";

export class ZenTodoSettingTab extends PluginSettingTab {
	plugin: ZenTodoPlugin;

	constructor(app: App, plugin: ZenTodoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Todo folder")
			.setDesc("Folder where todo list files are stored.")
			.addText((text) =>
				text
					.setPlaceholder("30_ToDos")
					.setValue(this.plugin.settings.todoFolder)
					.onChange(async (value) => {
						this.plugin.settings.todoFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show completed tasks by default")
			.setDesc("Expand the completed tasks section by default.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCompletedByDefault)
					.onChange(async (value) => {
						this.plugin.settings.showCompletedByDefault = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-complete parent task")
			.setDesc("Automatically complete parent tasks when all subtasks are done.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCompleteParent)
					.onChange(async (value) => {
						this.plugin.settings.autoCompleteParent = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
