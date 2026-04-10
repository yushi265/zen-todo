import type { TaskItem, TodoList } from "../types";
import type { Query, FilterType, DateFilter } from "./query-parser";
import { isToday, isThisWeek, isThisMonth, isOverdue } from "../utils/date-utils";

export interface QueryResultItem {
  task: TaskItem;
  listTitle: string;
  listFilePath: string;
}

function matchesDateFilter(dateStr: string | undefined, df: DateFilter): boolean {
  if (!dateStr) return false;
  switch (df.type) {
    case "relative":
      if (df.period === "today") return isToday(dateStr);
      if (df.period === "this_week") return isThisWeek(dateStr);
      return isThisMonth(dateStr);
    case "exact":
      return dateStr === df.date;
    case "before":
      return dateStr < df.date;
    case "after":
      return dateStr > df.date;
  }
}

function taskMatchesFilter(task: TaskItem, filter: FilterType): boolean {
  switch (filter.kind) {
    case "completed":
      return task.completed && matchesDateFilter(task.doneDate, filter.dateFilter);
    case "due":
      return matchesDateFilter(task.dueDate, filter.dateFilter);
    case "overdue":
      return !task.completed && !!task.dueDate && isOverdue(task.dueDate);
    case "incomplete":
      return !task.completed;
    case "list":
      // handled at list level — always true at task level
      return true;
    case "tag":
      return task.tags.some(
        (tag) => tag.toLowerCase() === filter.name.toLowerCase(),
      );
  }
}

function flattenTasks(tasks: TaskItem[]): TaskItem[] {
  const out: TaskItem[] = [];
  for (const task of tasks) {
    out.push(task);
    if (task.subtasks.length > 0) out.push(...flattenTasks(task.subtasks));
  }
  return out;
}

export function executeQuery(query: Query, lists: TodoList[]): QueryResultItem[] {
  const results: QueryResultItem[] = [];

  const listFilters = query.filters.filter((f) => f.kind === "list");
  const taskFilters = query.filters.filter((f) => f.kind !== "list");

  for (const list of lists) {
    // Apply list filter(s) at list level
    if (listFilters.length > 0) {
      const matchesList = listFilters.every(
        (f) =>
          f.kind === "list" &&
          list.title.toLowerCase().includes(f.name.toLowerCase()),
      );
      if (!matchesList) continue;
    }

    for (const task of flattenTasks(list.tasks)) {
      if (taskFilters.every((f) => taskMatchesFilter(task, f))) {
        results.push({
          task,
          listTitle: list.title,
          listFilePath: list.filePath,
        });
      }
    }
  }

  return results;
}
