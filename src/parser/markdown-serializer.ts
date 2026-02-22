import type { TaskItem } from "../types";
import {
  DUE_DATE_EMOJI,
  DONE_DATE_EMOJI,
  CREATED_DATE_EMOJI,
} from "../constants";

export function serializeToMarkdown(
  title: string,
  tasks: TaskItem[],
  archivedSection?: string,
): string {
  const lines: string[] = [`# ${title}`, ""];

  // Incomplete tasks first, then completed
  const incomplete = tasks.filter((t) => !t.completed);
  const complete = tasks.filter((t) => t.completed);

  for (const task of incomplete) serializeTask(task, 0, lines);
  for (const task of complete) serializeTask(task, 0, lines);

  let result = lines.join("\n") + "\n";
  if (archivedSection) {
    result += "\n" + archivedSection;
  }
  return result;
}

/** Convert a single task (with subtasks) to Markdown lines for archiving. */
export function serializeTaskToLines(task: TaskItem): string[] {
  const lines: string[] = [];
  serializeTask(task, 0, lines);
  return lines;
}

function serializeTask(task: TaskItem, depth: number, lines: string[]): void {
  const indent = "\t".repeat(depth);
  const checkChar = task.completed ? "x" : " ";

  let text = task.text;
  if (task.createdDate) text += ` ${CREATED_DATE_EMOJI} ${task.createdDate}`;
  if (task.dueDate) text += ` ${DUE_DATE_EMOJI} ${task.dueDate}`;
  if (task.completed && task.doneDate)
    text += ` ${DONE_DATE_EMOJI} ${task.doneDate}`;

  lines.push(`${indent}- [${checkChar}] ${text}`);

  // Notes: each line indented one level deeper than the task
  if (task.notes) {
    const noteIndent = "\t".repeat(depth + 1);
    for (const noteLine of task.notes.split("\n")) {
      lines.push(`${noteIndent}${noteLine}`);
    }
  }

  // Subtasks: incomplete first, then completed
  const incSub = task.subtasks.filter((t) => !t.completed);
  const doneSub = task.subtasks.filter((t) => t.completed);
  for (const sub of incSub) serializeTask(sub, depth + 1, lines);
  for (const sub of doneSub) serializeTask(sub, depth + 1, lines);
}
