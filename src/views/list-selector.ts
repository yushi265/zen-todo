import { setIcon } from "obsidian";

export function renderListSelector(
	container: HTMLElement,
	lists: { filePath: string; title: string }[],
	activeFilePath: string | null,
	onSelect: (filePath: string) => void,
	onCreateNew: () => void
): void {
	container.empty();

	const tabsEl = container.createDiv({ cls: "zen-todo-tabs" });

	for (const list of lists) {
		const isActive = list.filePath === activeFilePath;
		const tab = tabsEl.createEl("button", {
			cls: `zen-todo-tab${isActive ? " is-active" : ""}`,
			text: list.title,
			attr: {
				"aria-label": `Switch to ${list.title}`,
				role: "tab",
				"aria-selected": String(isActive),
			},
		});
		tab.addEventListener("click", () => onSelect(list.filePath));
	}

	const newBtn = container.createEl("button", {
		cls: "zen-todo-new-list-btn",
		attr: {
			"aria-label": "Create new list",
			"data-tooltip-position": "top",
		},
	});
	setIcon(newBtn, "plus");
	newBtn.addEventListener("click", onCreateNew);
}
