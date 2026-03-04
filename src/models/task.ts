import type { TaskItem, SortKey, SortDirection } from "../types";
import {
  DUE_DATE_EMOJI,
  DONE_DATE_EMOJI,
  CREATED_DATE_EMOJI,
} from "../constants";
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
    createdDate: today(),
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
  const cleanDone = new RegExp(
    `${DONE_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`,
    "g",
  );
  const cleanCreated = new RegExp(
    `${CREATED_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`,
    "g",
  );
  return text
    .replace(cleanDue, "")
    .replace(cleanDone, "")
    .replace(cleanCreated, "")
    .trim();
}

export function allSubtasksCompleted(task: TaskItem): boolean {
  if (task.subtasks.length === 0) return false;
  return task.subtasks.every((st) => st.completed);
}

export function cloneTask(task: TaskItem): TaskItem {
  return {
    id: task.id,
    text: task.text,
    completed: task.completed,
    createdDate: task.createdDate,
    dueDate: task.dueDate,
    doneDate: task.doneDate,
    subtasks: task.subtasks.map(cloneTask),
    indentLevel: task.indentLevel,
  };
}

export function cloneTasks(tasks: TaskItem[]): TaskItem[] {
  return tasks.map(cloneTask);
}

export function sortTasks(tasks: TaskItem[], sortKey: SortKey, direction: SortDirection = "asc"): TaskItem[] {
  if (sortKey === "manual") return tasks;
  const dir = direction === "desc" ? -1 : 1;
  return [...tasks].sort((a, b) => {
    switch (sortKey) {
      case "dueDate": {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate) * dir;
      }
      case "createdDate": {
        if (!a.createdDate && !b.createdDate) return 0;
        if (!a.createdDate) return 1;
        if (!b.createdDate) return -1;
        return b.createdDate.localeCompare(a.createdDate) * dir;
      }
      case "alphabetical": {
        return a.text.localeCompare(b.text, undefined, { sensitivity: "accent" }) * dir;
      }
      default:
        return 0;
    }
  });
}
