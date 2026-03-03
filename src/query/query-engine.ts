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
  }
}

function taskOrSubtaskMatchesFilter(task: TaskItem, filter: FilterType): boolean {
  if (taskMatchesFilter(task, filter)) return true;
  return task.subtasks.some((st) => taskOrSubtaskMatchesFilter(st, filter));
}

function taskMatchesAllFilters(
  task: TaskItem,
  listTitle: string,
  filters: FilterType[],
): boolean {
  for (const filter of filters) {
    if (filter.kind === "list") {
      if (!listTitle.toLowerCase().includes(filter.name.toLowerCase())) return false;
    } else {
      if (!taskOrSubtaskMatchesFilter(task, filter)) return false;
    }
  }
  return true;
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

    for (const task of list.tasks) {
      // Use taskFilters for task-level matching (list filters already applied above)
      const fakeQuery = { filters: taskFilters };
      if (taskMatchesAllFilters(task, list.title, fakeQuery.filters)) {
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
