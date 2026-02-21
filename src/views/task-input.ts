export function renderTaskInput(
	container: HTMLElement,
	onAdd: (text: string, dueDate?: string) => void
): void {
	const row = container.createDiv({ cls: "zen-todo-input-row" });

	const textInput = row.createEl("input", {
		type: "text",
		cls: "zen-todo-text-input",
		attr: { placeholder: "Add a task...", "aria-label": "New task text" },
	});

	const dateInput = row.createEl("input", {
		type: "date",
		cls: "zen-todo-input-date",
		attr: { "aria-label": "Due date for new task" },
	});

	const addBtn = row.createEl("button", {
		cls: "zen-todo-add-btn",
		text: "Add",
		attr: { "aria-label": "Add task" },
	});

	const submit = () => {
		const text = textInput.value.trim();
		if (!text) return;
		const dueDate = dateInput.value || undefined;
		onAdd(text, dueDate);
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
}
