export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  createdDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  doneDate?: string; // YYYY-MM-DD
  subtasks: TaskItem[];
  indentLevel: number;
}

export interface TodoList {
  filePath: string;
  title: string;
  description?: string;
  tasks: TaskItem[];
  archivedSection?: string;
}

export type SortKey = "manual" | "dueDate" | "createdDate" | "alphabetical";

export type SortDirection = "asc" | "desc";

export interface ZenTodoSettings {
  todoFolder: string;
  showCompletedByDefault: boolean;
  autoCompleteParent: boolean;
  listOrder: string[];
  excludedFromAll: string[];
  language: string; // "" = follow Obsidian, "en" | "ja" | ... = override
  defaultSortKey: SortKey;
  openAllViewByDefault: boolean;
}

export type UndoActionType =
  | "delete"
  | "archive"
  | "archiveAllCompleted"
  | "toggle"
  | "move";

export interface ListSnapshot {
  filePath: string;
  tasks: TaskItem[];
  archivedSection?: string;
}

export interface UndoState {
  actionType: UndoActionType;
  description: string;
  snapshots: ListSnapshot[];
  timestamp: number;
}
