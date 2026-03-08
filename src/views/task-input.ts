import { t } from "../i18n";

export function renderTaskInput(
	container: HTMLElement,
	onAdd: (text: string, dueDate?: string, targetFilePath?: string) => void,
	lists?: { filePath: string; title: string }[],
	selectedFilePath?: string | null,
	onListChange?: (filePath: string) => void,
	renderTrailingAction?: (controls: HTMLElement) => void,
): void {
	const row = container.createDiv({ cls: "zen-todo-input-row" });
	const controls = container.createDiv({ cls: "zen-todo-input-controls" });

	// List selector dropdown (All view only)
	let listSelect: HTMLSelectElement | null = null;
	if (lists && lists.length > 0) {
		listSelect = controls.createEl("select", {
			cls: "zen-todo-list-select",
			attr: { "aria-label": t("input.addToList") },
		});
		for (const list of lists) {
			listSelect.createEl("option", {
				value: list.filePath,
				text: list.title,
			});
		}
		if (selectedFilePath) {
			listSelect.value = selectedFilePath;
		}
		listSelect.addEventListener("change", () => {
			onListChange?.(listSelect!.value);
		});
	}

	const textInput = row.createEl("input", {
		type: "text",
		cls: "zen-todo-text-input",
		attr: { placeholder: t("input.taskPlaceholder"), "aria-label": t("input.taskAriaLabel") },
	});

	const dateInput = controls.createEl("input", {
		type: "date",
		cls: "zen-todo-input-date",
		attr: { "aria-label": t("input.dueDateLabel") },
	});

	const addBtn = controls.createEl("button", {
		cls: "zen-todo-add-btn",
		text: t("input.addButton"),
		attr: { "aria-label": t("input.addButtonLabel") },
	});

	const submit = () => {
		const text = textInput.value.trim();
		if (!text) return;
		const dueDate = dateInput.value || undefined;
		const targetFilePath = listSelect?.value || undefined;
		onAdd(text, dueDate, targetFilePath);
		textInput.value = "";
		dateInput.value = "";
		textInput.focus();
	};

	textInput.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.isComposing) {
			e.preventDefault();
			submit();
		}
	});

	addBtn.addEventListener("click", submit);

	renderTrailingAction?.(controls);
}
