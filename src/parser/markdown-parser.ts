import type { TaskItem } from "../types";
import {
  DUE_DATE_EMOJI,
  DONE_DATE_EMOJI,
  CREATED_DATE_EMOJI,
} from "../constants";
import { createTaskId, parseTaskInput } from "../models/task";
import { t } from "../i18n";

// Note: No lookbehind regex used (iOS < 16.4 incompatibility)
const CHECKBOX_REGEX = /^(\s*)- \[([ xX])\]\s+(.*)/;

export function parseMarkdown(content: string): {
  title: string;
  description?: string;
  tasks: TaskItem[];
  archivedSection?: string;
} {
  // Create regex instances per call to avoid global lastIndex issues
  const dueDateRegex = new RegExp(
    `${DUE_DATE_EMOJI}\\s+(\\d{4}-\\d{2}-\\d{2})`,
  );
  const doneDateRegex = new RegExp(
    `${DONE_DATE_EMOJI}\\s+(\\d{4}-\\d{2}-\\d{2})`,
  );
  const createdDateRegex = new RegExp(
    `${CREATED_DATE_EMOJI}\\s+(\\d{4}-\\d{2}-\\d{2})`,
  );
  const cleanupDue = new RegExp(
    `${DUE_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`,
    "g",
  );
  const cleanupDone = new RegExp(
    `${DONE_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`,
    "g",
  );
  const cleanupCreated = new RegExp(
    `${CREATED_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`,
    "g",
  );

  // Split out the ## Archived section before parsing tasks
  const ARCHIVED_HEADING = "\n## Archived";
  const archivedIdx = content.indexOf(ARCHIVED_HEADING);
  let archivedSection: string | undefined;
  let mainContent = content;
  if (archivedIdx !== -1) {
    archivedSection = content.slice(archivedIdx + 1); // keep "## Archived\n..."
    mainContent = content.slice(0, archivedIdx);
  }

  const lines = mainContent.split("\n");
  let title = "";
  const descriptionLines: string[] = [];
  let firstTaskFound = false;
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
    if (!match) {
      // Accumulate description lines between title and first task
      if (title && !firstTaskFound) {
        descriptionLines.push(line);
      }
      continue;
    }

    firstTaskFound = true;

    const [, indent, checkChar, rest] = match;
    const indentLevel = indent.length;
    const completed = checkChar.toLowerCase() === "x";

    const dueDateMatch = dueDateRegex.exec(rest);
    const doneDateMatch = doneDateRegex.exec(rest);
    const createdDateMatch = createdDateRegex.exec(rest);
    const dueDate = dueDateMatch ? dueDateMatch[1] : undefined;
    const doneDate = doneDateMatch ? doneDateMatch[1] : undefined;
    const createdDate = createdDateMatch ? createdDateMatch[1] : undefined;

    const cleanedText = rest
      .replace(cleanupDue, "")
      .replace(cleanupDone, "")
      .replace(cleanupCreated, "")
      .trim();
    const { text, tags } = parseTaskInput(cleanedText);

    const task: TaskItem = {
      id: createTaskId(),
      text,
      tags,
      completed,
      createdDate,
      dueDate,
      doneDate,
      subtasks: [],
      indentLevel,
    };

    // Pop stack until we find a parent at a shallower indent level
    while (
      stack.length > 0 &&
      stack[stack.length - 1].indentLevel >= indentLevel
    ) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootTasks.push(task);
    } else {
      stack[stack.length - 1].task.subtasks.push(task);
    }
    stack.push({ task, indentLevel });
  }

  const description = descriptionLines.join("\n").trim() || undefined;
  return { title: title || t("parser.untitled"), description, tasks: rootTasks, archivedSection };
}
