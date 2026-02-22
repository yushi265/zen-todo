export interface TaskItem {
	id: string;
	text: string;
	completed: boolean;
	dueDate?: string; // YYYY-MM-DD
	doneDate?: string; // YYYY-MM-DD
	notes?: string;
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
