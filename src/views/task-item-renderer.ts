import { setIcon, Menu, Platform } from "obsidian";
import type { TaskItem } from "../types";
import { isOverdue, isToday } from "../utils/date-utils";

export type TaskActionType = "toggle" | "delete" | "edit" | "add-subtask" | "set-due";

export interface TaskActionEvent {
	action: TaskActionType;
	task: TaskItem;
	value?: string;
	parentTask?: TaskItem;
}

export interface RenderTaskOptions {
	addingSubtaskFor?: string | null;
	onSubtaskSubmit?: (parentTask: TaskItem, text: string) => void;
	onSubtaskCancel?: () => void;
}

export function renderTaskItem(
	container: HTMLElement,
	task: TaskItem,
	onAction: (event: TaskActionEvent) => void,
	parentTask?: TaskItem,
	options: RenderTaskOptions = {}
): void {
	const itemEl = container.createDiv({
		cls: `zen-todo-task-item${task.completed ? " is-completed" : ""}`,
	});

	// Row wrapper: checkbox + content + badges + actions (horizontal)
	const rowEl = itemEl.createDiv({ cls: "zen-todo-task-row" });

	// Checkbox
	const checkbox = rowEl.createEl("input", {
		type: "checkbox",
		cls: "zen-todo-checkbox",
		attr: {
			"aria-label": task.completed ? "Mark as incomplete" : "Mark as complete",
		},
	});
	checkbox.checked = task.completed;
	checkbox.addEventListener("change", () => {
		onAction({ action: "toggle", task, parentTask });
	});

	// Content area (text + inline edit input)
	const contentArea = rowEl.createDiv({ cls: "zen-todo-task-content" });

	const textSpan = contentArea.createSpan({
		cls: "zen-todo-task-text",
		text: task.text,
		attr: {
			tabindex: "0",
			role: "button",
			"aria-label": "Edit task",
		},
	});

	// Edit input — hidden by default, toggled on click
	const editInput = contentArea.createEl("input", {
		type: "text",
		cls: "zen-todo-task-edit-input is-hidden",
		attr: { "aria-label": "Edit task text" },
	});
	editInput.value = task.text;

	const startEditing = () => {
		textSpan.addClass("is-hidden");
		editInput.removeClass("is-hidden");
		editInput.focus();
		editInput.select();
	};

	let editSaved = false;

	const saveEdit = () => {
		if (editSaved) return;
		editSaved = true;
		const newText = editInput.value.trim();
		if (newText && newText !== task.text) {
			onAction({ action: "edit", task, value: newText, parentTask });
		} else {
			// Restore text span
			editInput.addClass("is-hidden");
			textSpan.removeClass("is-hidden");
			editSaved = false;
		}
	};

	const cancelEdit = () => {
		editInput.value = task.text;
		editInput.addClass("is-hidden");
		textSpan.removeClass("is-hidden");
		editSaved = false;
	};

	if (!Platform.isMobile) {
		textSpan.addEventListener("click", startEditing);
	}
	textSpan.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			startEditing();
		}
	});

	editInput.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.isComposing) {
			e.preventDefault();
			saveEdit();
		} else if (e.key === "Escape") {
			cancelEdit();
		}
	});
	editInput.addEventListener("blur", saveEdit);

	// Due date badge
	if (task.dueDate && !task.completed) {
		const badge = rowEl.createSpan({ cls: "zen-todo-due-badge" });
		badge.textContent = `📅 ${task.dueDate}`;
		if (isOverdue(task.dueDate)) badge.addClass("is-overdue");
		else if (isToday(task.dueDate)) badge.addClass("is-today");
	}

	// Done date badge
	if (task.completed && task.doneDate) {
		rowEl.createSpan({
			cls: "zen-todo-done-badge",
			text: `✅ ${task.doneDate}`,
		});
	}

	// Actions area
	const actionsEl = rowEl.createDiv({ cls: "zen-todo-task-actions" });

	// Inline date input — hidden by default, shown by calendar button
	const dateInput = actionsEl.createEl("input", {
		type: "date",
		cls: "zen-todo-inline-date is-hidden",
		attr: { "aria-label": "Due date" },
	});
	if (task.dueDate) dateInput.value = task.dueDate;

	dateInput.addEventListener("change", () => {
		onAction({ action: "set-due", task, value: dateInput.value || undefined, parentTask });
		dateInput.addClass("is-hidden");
	});
	dateInput.addEventListener("blur", () => {
		// Small delay to allow change event to fire first
		setTimeout(() => dateInput.addClass("is-hidden"), 150);
	});

	// Calendar button
	const calBtn = actionsEl.createEl("button", {
		cls: "zen-todo-action-btn",
		attr: {
			"aria-label": "Set due date",
			"data-tooltip-position": "top",
		},
	});
	setIcon(calBtn, "calendar");
	calBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		dateInput.removeClass("is-hidden");
		dateInput.focus();
		(dateInput as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
	});

	// Add subtask button (root tasks only, not completed)
	if (!parentTask && !task.completed) {
		const addSubBtn = actionsEl.createEl("button", {
			cls: "zen-todo-action-btn",
			attr: {
				"aria-label": "Add subtask",
				"data-tooltip-position": "top",
			},
		});
		setIcon(addSubBtn, "plus");
		addSubBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			onAction({ action: "add-subtask", task, parentTask });
		});
	}

	// Delete button
	const delBtn = actionsEl.createEl("button", {
		cls: "zen-todo-action-btn zen-todo-delete-btn",
		attr: {
			"aria-label": "Delete task",
			"data-tooltip-position": "top",
		},
	});
	setIcon(delBtn, "trash-2");
	delBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		onAction({ action: "delete", task, parentTask });
	});

	// ── Mobile: long-press context menu ──
	if (Platform.isMobile) {
		addLongPressHandler(rowEl, (e) => {
			const menu = new Menu();

			menu.addItem((item) => {
				item.setTitle("Edit")
					.setIcon("pencil")
					.onClick(() => {
						startEditing();
					});
			});

			if (!parentTask) {
				menu.addItem((item) => {
					item.setTitle("Add subtask")
						.setIcon("plus")
						.onClick(() => {
							onAction({ action: "add-subtask", task, parentTask });
						});
				});
			}

			menu.addItem((item) => {
				item.setTitle("Set due date")
					.setIcon("calendar")
					.onClick(() => {
						const tmpDate = createEl("input", { type: "date" });
						if (task.dueDate) tmpDate.value = task.dueDate;
						tmpDate.setCssStyles({ position: "absolute", opacity: "0", pointerEvents: "none" });
						rowEl.appendChild(tmpDate);
						tmpDate.addEventListener("change", () => {
							onAction({ action: "set-due", task, value: tmpDate.value || undefined, parentTask });
							tmpDate.remove();
						});
						tmpDate.addEventListener("blur", () => {
							setTimeout(() => tmpDate.remove(), 200);
						});
						try { (tmpDate as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { tmpDate.click(); }
					});
			});

			menu.addItem((item) => {
				item.setTitle("Delete")
					.setIcon("trash-2")
					.onClick(() => {
						onAction({ action: "delete", task, parentTask });
					});
			});

			const touch = e.touches[0];
			menu.showAtPosition({ x: touch.clientX, y: touch.clientY });
		});
	}

	// Subtasks container
	if (task.subtasks.length > 0 || options.addingSubtaskFor === task.id) {
		const subtasksEl = itemEl.createDiv({ cls: "zen-todo-subtasks" });
		for (const subtask of task.subtasks) {
			renderTaskItem(subtasksEl, subtask, onAction, task);
		}
		if (options.addingSubtaskFor === task.id && options.onSubtaskSubmit) {
			renderSubtaskInput(subtasksEl, task, options.onSubtaskSubmit, options.onSubtaskCancel ?? (() => {}));
		}
	}
}

function addLongPressHandler(
	el: HTMLElement,
	callback: (e: TouchEvent) => void,
	duration = 500
): void {
	let timer: number | null = null;

	el.addEventListener("touchstart", (e: TouchEvent) => {
		timer = window.setTimeout(() => {
			// Prevent the subsequent tap/click from firing
			el.addEventListener("click", (ev) => {
				ev.stopPropagation();
				ev.preventDefault();
			}, { once: true, capture: true });
			callback(e);
			timer = null;
		}, duration);
	}, { passive: true });

	el.addEventListener("touchend", () => {
		if (timer) { clearTimeout(timer); timer = null; }
	});

	el.addEventListener("touchmove", () => {
		if (timer) { clearTimeout(timer); timer = null; }
	}, { passive: true });
}

function renderSubtaskInput(
	container: HTMLElement,
	parentTask: TaskItem,
	onSubmit: (parentTask: TaskItem, text: string) => void,
	onCancel: () => void
): void {
	const row = container.createDiv({ cls: "zen-todo-subtask-input-row" });
	const input = row.createEl("input", {
		type: "text",
		cls: "zen-todo-subtask-input",
		attr: {
			placeholder: "Add a subtask...",
			"aria-label": "New subtask text",
		},
	});

	const submit = () => {
		const text = input.value.trim();
		if (!text) return;
		onSubmit(parentTask, text);
	};

	input.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.isComposing) {
			e.preventDefault();
			submit();
		} else if (e.key === "Escape") {
			onCancel();
		}
	});

	input.addEventListener("blur", () => {
		// 少し遅延して、Enter の submit と競合しないようにする
		setTimeout(() => onCancel(), 150);
	});

	// Defer focus so the render cycle completes first
	setTimeout(() => input.focus(), 0);
}
