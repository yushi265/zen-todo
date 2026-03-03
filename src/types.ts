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
  tasks: TaskItem[];
  archivedSection?: string;
}

export interface ZenTodoSettings {
  todoFolder: string;
  showCompletedByDefault: boolean;
  autoCompleteParent: boolean;
  listOrder: string[];
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
