import type { TaskItem } from "../types";
import { DUE_DATE_EMOJI, DONE_DATE_EMOJI } from "../constants";
import { createTaskId } from "../models/task";

// Note: No lookbehind regex used (iOS < 16.4 incompatibility)
const CHECKBOX_REGEX = /^(\s*)- \[([ xX])\]\s+(.*)/;

export function parseMarkdown(content: string): { title: string; tasks: TaskItem[] } {
	// Create regex instances per call to avoid global lastIndex issues
	const dueDateRegex = new RegExp(`${DUE_DATE_EMOJI}\\s+(\\d{4}-\\d{2}-\\d{2})`);
	const doneDateRegex = new RegExp(`${DONE_DATE_EMOJI}\\s+(\\d{4}-\\d{2}-\\d{2})`);
	const cleanupDue = new RegExp(`${DUE_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`, "g");
	const cleanupDone = new RegExp(`${DONE_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`, "g");

	const lines = content.split("\n");
	let title = "";
	const rootTasks: TaskItem[] = [];
	// Stack tracks parent tasks by indent level
	const stack: { task: TaskItem; indentLevel: number }[] = [];

	for (const line of lines) {
		// Extract title from first H1 heading
		if (line.startsWith("# ") && !title) {
			title = line.slice(2).trim();
			continue;
		}

		const match = CHECKBOX_REGEX.exec(line);
		if (!match) continue;

		const [, indent, checkChar, rest] = match;
		const indentLevel = indent.length;
		const completed = checkChar.toLowerCase() === "x";

		const dueDateMatch = dueDateRegex.exec(rest);
		const doneDateMatch = doneDateRegex.exec(rest);
		const dueDate = dueDateMatch ? dueDateMatch[1] : undefined;
		const doneDate = doneDateMatch ? doneDateMatch[1] : undefined;

		const text = rest.replace(cleanupDue, "").replace(cleanupDone, "").trim();

		const task: TaskItem = {
			id: createTaskId(),
			text,
			completed,
			dueDate,
			doneDate,
			subtasks: [],
			indentLevel,
		};

		// Pop stack until we find a parent at a shallower indent level
		while (stack.length > 0 && stack[stack.length - 1].indentLevel >= indentLevel) {
			stack.pop();
		}

		if (stack.length === 0) {
			rootTasks.push(task);
		} else {
			stack[stack.length - 1].task.subtasks.push(task);
		}
		stack.push({ task, indentLevel });
	}

	return { title: title || "Untitled", tasks: rootTasks };
}
