import type { TaskItem, SortKey, SortDirection } from "../types";
import {
  DUE_DATE_EMOJI,
  DONE_DATE_EMOJI,
  CREATED_DATE_EMOJI,
} from "../constants";
import { today } from "../utils/date-utils";

let idCounter = 0;
const TAG_SEGMENT_REGEX = /^[\p{L}\p{N}_-]+$/u;

export function createTaskId(): string {
  return `task-${Date.now()}-${idCounter++}`;
}

export function createTask(text: string, dueDate?: string): TaskItem {
  const parsed = parseTaskInput(text);
  return {
    id: createTaskId(),
    text: parsed.text,
    tags: parsed.tags,
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

export function parseTaskInput(text: string): Pick<TaskItem, "text" | "tags"> {
  const { text: extractedText, tags } = extractTaskTextAndTags(cleanTaskText(text));
  return {
    text: extractedText,
    tags,
  };
}

export function formatTaskTextWithTags(text: string, tags: string[]): string {
  const normalizedTags = normalizeTaskTags(tags);
  if (normalizedTags.length === 0) return text.trim();
  const tagText = normalizedTags.map((tag) => `#${tag}`).join(" ");
  return text.trim() ? `${text.trim()} ${tagText}` : tagText;
}

export function normalizeTaskTags(tags: string[]): string[] {
  const normalized: string[] = [];
  for (const rawTag of tags) {
    const tag = rawTag.trim().replace(/^#+/, "");
    if (!isValidTaskTag(tag)) continue;
    if (!normalized.includes(tag)) {
      normalized.push(tag);
    }
  }
  return normalized;
}

function extractTaskTextAndTags(input: string): { text: string; tags: string[] } {
  const textParts: string[] = [];
  const tags: string[] = [];
  let index = 0;
  let insideWikiLink = false;

  while (index < input.length) {
    if (!insideWikiLink && input.startsWith("[[", index)) {
      insideWikiLink = true;
      textParts.push("[[");
      index += 2;
      continue;
    }

    if (insideWikiLink && input.startsWith("]]", index)) {
      insideWikiLink = false;
      textParts.push("]]");
      index += 2;
      continue;
    }

    const current = input[index];
    const previous = index > 0 ? input[index - 1] : "";
    if (!insideWikiLink && current === "#" && (index === 0 || /\s/.test(previous))) {
      const consumed = consumeTagToken(input, index);
      if (consumed) {
        tags.push(consumed.tag);
        index = consumed.nextIndex;
        continue;
      }
    }

    textParts.push(current);
    index += 1;
  }

  return {
    text: textParts.join("").replace(/\s{2,}/g, " ").trim(),
    tags: normalizeTaskTags(tags),
  };
}

function consumeTagToken(
  input: string,
  startIndex: number,
): { tag: string; nextIndex: number } | null {
  let endIndex = startIndex + 1;
  while (endIndex < input.length && !/\s/.test(input[endIndex])) {
    endIndex += 1;
  }

  const token = input.slice(startIndex + 1, endIndex);
  if (!isValidTaskTag(token)) {
    return null;
  }

  return {
    tag: token,
    nextIndex: endIndex,
  };
}

function isValidTaskTag(tag: string): boolean {
  if (!tag || tag.startsWith("/") || tag.endsWith("/")) return false;
  return tag.split("/").every((segment) => TAG_SEGMENT_REGEX.test(segment));
}

export function allSubtasksCompleted(task: TaskItem): boolean {
  if (task.subtasks.length === 0) return false;
  return task.subtasks.every((st) => st.completed);
}

export function cloneTask(task: TaskItem): TaskItem {
  return {
    id: task.id,
    text: task.text,
    tags: [...task.tags],
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

export function findTaskInTree(tasks: TaskItem[], taskId: string): TaskItem | null {
  for (const task of tasks) {
    if (task.id === taskId) return task;
    const found = findTaskInTree(task.subtasks, taskId);
    if (found) return found;
  }
  return null;
}

export function removeTaskFromTree(tasks: TaskItem[], taskId: string): TaskItem | null {
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === taskId) {
      const [removed] = tasks.splice(i, 1);
      return removed;
    }
    const removed = removeTaskFromTree(tasks[i].subtasks, taskId);
    if (removed) return removed;
  }
  return null;
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
