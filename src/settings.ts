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

		new Setting(containerEl)
			.setName(t("settings.defaultSort.name"))
			.setDesc(t("settings.defaultSort.desc"))
			.addDropdown((drop) =>
				drop
					.addOption("manual", t("sort.manual"))
					.addOption("dueDate", t("sort.dueDate"))
					.addOption("createdDate", t("sort.createdDate"))
					.addOption("alphabetical", t("sort.alphabetical"))
					.setValue(this.plugin.settings.defaultSortKey)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortKey = value as import("./types").SortKey;
						await this.plugin.saveSettings();
						this.plugin.refreshAllViews();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.openAllView.name"))
			.setDesc(t("settings.openAllView.desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openAllViewByDefault)
					.onChange(async (value) => {
						this.plugin.settings.openAllViewByDefault = value;
						await this.plugin.saveSettings();
					})
			);

		// Hidden lists section
		new Setting(containerEl)
			.setName(t("settings.hiddenLists.name"))
			.setDesc(t("settings.hiddenLists.desc"))
			.setHeading();

		const hiddenLists = this.plugin.settings.hiddenLists;
		if (hiddenLists.length === 0) {
			containerEl.createEl("p", {
				text: t("settings.hiddenLists.empty"),
				cls: "setting-item-description",
			});
		} else {
			for (const filePath of hiddenLists) {
				const fileName = filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
				new Setting(containerEl)
					.setName(fileName)
					.setDesc(filePath)
					.addButton((btn) =>
						btn
							.setButtonText(t("settings.hiddenLists.unhide"))
							.onClick(async () => {
								this.plugin.settings.hiddenLists = this.plugin.settings.hiddenLists.filter(
									(p) => p !== filePath,
								);
								await this.plugin.saveSettings();
								this.plugin.refreshAllViews();
								this.display();
							}),
					);
			}
		}
	}
}
