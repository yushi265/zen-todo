import { setIcon } from "obsidian";
import type { TaskItem } from "../types";
import {
	renderTaskItem,
	type TaskActionEvent,
	type RenderTaskOptions,
} from "./task-item-renderer";

export function renderTaskSection(
	container: HTMLElement,
	incomplete: TaskItem[],
	complete: TaskItem[],
	showCompleted: boolean,
	onAction: (event: TaskActionEvent) => void,
	onArchiveAll?: () => void,
	options: RenderTaskOptions = {}
): void {
	// Incomplete tasks
	const incSection = container.createDiv({ cls: "zen-todo-incomplete-section" });

	if (incomplete.length === 0 && complete.length === 0) {
		incSection.createDiv({
			cls: "zen-todo-empty",
			text: "No tasks yet. Add one above!",
		});
	} else {
		for (const task of incomplete) {
			renderTaskItem(incSection, task, onAction, undefined, options);
		}
	}

	// Completed tasks (collapsible)
	if (complete.length > 0) {
		const details = container.createEl("details", {
			cls: "zen-todo-completed-section",
		});
		if (showCompleted) details.setAttribute("open", "");

		const summary = details.createEl("summary", {
			cls: "zen-todo-completed-summary",
		});
		summary.createSpan({ text: `Completed (${complete.length})` });

		if (onArchiveAll) {
			const archiveAllBtn = summary.createEl("button", {
				cls: "zen-todo-archive-all-btn",
				attr: {
					"aria-label": "Archive all completed",
					"data-tooltip-position": "top",
				},
			});
			setIcon(archiveAllBtn, "archive");
			archiveAllBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				onArchiveAll();
			});
		}

		for (const task of complete) {
			renderTaskItem(details, task, onAction, undefined, options);
		}
	}
}
