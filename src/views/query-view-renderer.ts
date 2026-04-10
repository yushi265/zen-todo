import { App } from "obsidian";
import type { TaskItem } from "../types";
import type { QueryResultItem } from "../query/query-engine";
import type { Query } from "../query/query-parser";
import { describeQuery } from "../query/query-parser";
import { renderWikiLinkedText } from "./task-item-renderer";
import { isOverdue, isToday } from "../utils/date-utils";
import { t } from "../i18n";

export interface QueryViewOptions {
  query: Query;
  results: QueryResultItem[];
  errors: string[];
  app: App;
  sourcePath: string;
  onToggle: (task: TaskItem, listFilePath: string) => void;
}

export function renderQueryView(
  container: HTMLElement,
  opts: QueryViewOptions,
): void {
  container.empty();

  const { query, results, errors, app, sourcePath, onToggle } = opts;

  // Header
  const headerEl = container.createDiv({ cls: "zen-todo-query-header" });
  headerEl.createSpan({
    cls: "zen-todo-query-title",
    text: describeQuery(query),
  });
  headerEl.createSpan({
    cls: "zen-todo-query-count",
    text: ` — ${results.length} ${results.length !== 1 ? t("query.tasks") : t("query.task")}`,
  });

  // Parse errors
  for (const err of errors) {
    container.createDiv({ cls: "zen-todo-query-error", text: err });
  }

  if (results.length === 0) {
    container.createDiv({
      cls: "zen-todo-query-empty",
      text: t("query.empty"),
    });
    return;
  }

  // Group by list
  const groups = new Map<string, QueryResultItem[]>();
  for (const item of results) {
    const key = item.listFilePath;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  for (const [, items] of groups) {
    const groupEl = container.createDiv({ cls: "zen-todo-query-group" });
    groupEl.createDiv({
      cls: "zen-todo-query-group-header",
      text: items[0].listTitle,
    });

    for (const { task, listFilePath } of items) {
      renderQueryTaskItem(groupEl, task, listFilePath, app, sourcePath, onToggle);
    }
  }
}

function renderQueryTaskItem(
  container: HTMLElement,
  task: TaskItem,
  listFilePath: string,
  app: App,
  sourcePath: string,
  onToggle: (task: TaskItem, listFilePath: string) => void,
): void {
  const itemEl = container.createDiv({
    cls: `zen-todo-query-task-item${task.completed ? " is-completed" : ""}`,
  });

  const rowEl = itemEl.createDiv({ cls: "zen-todo-query-task-row" });

  // Checkbox
  const checkbox = rowEl.createEl("input", {
    type: "checkbox",
    cls: "zen-todo-checkbox",
    attr: {
      "aria-label": task.completed ? t("task.markIncomplete") : t("task.markComplete"),
    },
  });
  checkbox.checked = task.completed;
  checkbox.addEventListener("change", () => {
    onToggle(task, listFilePath);
  });

  // Text
  const contentEl = rowEl.createDiv({ cls: "zen-todo-query-task-content" });
  const primaryLine = contentEl.createDiv({ cls: "zen-todo-query-task-primary-line" });

  const textSpan = primaryLine.createSpan({ cls: "zen-todo-query-task-text" });
  if (task.text.includes("[[")) {
    renderWikiLinkedText(textSpan, task.text, app, sourcePath);
  } else {
    textSpan.textContent = task.text;
  }

  if (task.tags.length > 0) {
    const tagsEl = primaryLine.createDiv({ cls: "zen-todo-task-tags" });
    for (const tag of task.tags) {
      tagsEl.createSpan({
        cls: "zen-todo-task-tag",
        text: `#${tag}`,
      });
    }
  }

  // Due date badge
  if (task.dueDate && !task.completed) {
    const badge = rowEl.createSpan({ cls: "zen-todo-due-badge" });
    if (isOverdue(task.dueDate)) {
      badge.addClass("is-overdue");
      badge.textContent = `⚠️ ${task.dueDate}`;
    } else if (isToday(task.dueDate)) {
      badge.addClass("is-today");
      badge.textContent = `🔔 ${task.dueDate}`;
    } else {
      badge.textContent = `📅 ${task.dueDate}`;
    }
  }

  // Done date badge
  if (task.completed && task.doneDate) {
    rowEl.createSpan({
      cls: "zen-todo-done-badge",
      text: `✅ ${task.doneDate}`,
    });
  }

}
