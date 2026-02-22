import type { ZenTodoSettings } from "./types";

export const VIEW_TYPE_ZEN_TODO = "zen-todo-view";

export const DEFAULT_SETTINGS: ZenTodoSettings = {
	todoFolder: "30_ToDos",
	showCompletedByDefault: false,
	autoCompleteParent: true,
	listOrder: [],
};

export const DUE_DATE_EMOJI = "📅";
export const DONE_DATE_EMOJI = "✅";
