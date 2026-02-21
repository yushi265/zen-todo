import type { TaskItem } from "../types";
import { DUE_DATE_EMOJI, DONE_DATE_EMOJI } from "../constants";
import { today } from "../utils/date-utils";

let idCounter = 0;

export function createTaskId(): string {
	return `task-${Date.now()}-${idCounter++}`;
}

export function createTask(text: string, dueDate?: string): TaskItem {
	return {
		id: createTaskId(),
		text: cleanTaskText(text),
		completed: false,
		dueDate,
		doneDate: undefined,
		subtasks: [],
		indentLevel: 0,
	};
}

export function completeTask(task: TaskItem): TaskItem {
	return { ...task, completed: true, doneDate: today() };
}

export function uncompleteTask(task: TaskItem): TaskItem {
	return { ...task, completed: false, doneDate: undefined };
}

export function cleanTaskText(text: string): string {
	const cleanDue = new RegExp(`${DUE_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`, "g");
	const cleanDone = new RegExp(`${DONE_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`, "g");
	return text.replace(cleanDue, "").replace(cleanDone, "").trim();
}

export function allSubtasksCompleted(task: TaskItem): boolean {
	if (task.subtasks.length === 0) return false;
	return task.subtasks.every((st) => st.completed);
}
