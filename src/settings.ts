import { App, PluginSettingTab, Setting, getLanguage } from "obsidian";
import type ZenTodoPlugin from "./main";
import { initLocale, t } from "./i18n";

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
			.setName(t("settings.language.name"))
			.setDesc(t("settings.language.desc"))
			.addDropdown((drop) =>
				drop
					.addOption("", t("settings.language.auto"))
					.addOption("en", "English")
					.addOption("ja", "日本語")
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
						initLocale(value || getLanguage());
						this.plugin.refreshAllViews();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.todoFolder.name"))
			.setDesc(t("settings.todoFolder.desc"))
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
			.setName(t("settings.showCompleted.name"))
			.setDesc(t("settings.showCompleted.desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCompletedByDefault)
					.onChange(async (value) => {
						this.plugin.settings.showCompletedByDefault = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.autoComplete.name"))
			.setDesc(t("settings.autoComplete.desc"))
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
