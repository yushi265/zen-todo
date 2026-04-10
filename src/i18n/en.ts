import type { TranslationKeys } from "./types";

export const en: TranslationKeys = {
  // main.ts
  "ribbon.openZenTodo": "Open ZenTodo",
  "command.openTodoList": "Open todo list",
  "command.createNewList": "Create new todo list",
  "command.openAllView": "Open All view",

  // date-utils.ts
  "date.today": "Today",
  "date.yesterday": "Yesterday",
  "date.daysAgo": "{{count}} days ago",
  "date.oneWeekAgo": "1 week ago",
  "date.twoWeeksAgo": "2 weeks ago",
  "date.threeWeeksAgo": "3 weeks ago",
  "date.monthsAgo": "{{count}} months ago",
  "date.yearsAgo": "{{count}} years ago",

  // todo-controller.ts — undo messages
  "undo.moved": 'Moved "{{name}}"',
  "undo.completed": 'Completed "{{name}}"',
  "undo.uncompleted": 'Marked "{{name}}" as incomplete',
  "undo.deleted": 'Deleted "{{name}}"',
  "undo.archived": 'Archived "{{name}}"',
  "undo.archivedAll": "Archived {{count}} completed tasks",
  "undo.reparented": 'Moved "{{name}}" to subtask',
  "undo.unparented": 'Moved "{{name}}" to root',
  "undo.button": "Undo",

  // todo-controller.ts — empty state
  "noLists.message": "No todo lists found.",
  "noLists.hint": "Click + to create a list, or add .md files to {{folder}}/",

  // new list modal
  "modal.newList.title": "Create new todo list",
  "modal.newList.placeholder": "List name...",
  "modal.newList.ariaLabel": "List name",
  "modal.newList.submit": "Create",

  // remove link modal
  "modal.removeLink.title": "Remove link",
  "modal.removeLink.message": 'Move the note "{{name}}" to the trash and remove the link?',
  "modal.removeLink.cancel": "Cancel",
  "modal.removeLink.confirm": "Remove",

  // hide list modal
  "modal.hideList.title": "Hide list",
  "modal.hideList.message": 'Hide "{{name}}" from the sidebar? The file will remain in your vault.',
  "modal.hideList.confirm": "Hide",
  "modal.hideList.cancel": "Cancel",

  // task-item-renderer.ts — aria labels
  "task.markComplete": "Mark as complete",
  "task.markIncomplete": "Mark as incomplete",
  "task.editLabel": "Edit task",
  "task.editInputLabel": "Edit task text",
  "task.dueDateLabel": "Due date",
  "task.setDueDate": "Set due date",
  "task.insertLink": "Insert link",
  "task.removeLink": "Remove link",
  "task.addSubtask": "Add subtask",
  "task.moveToList": "Move to list",
  "task.archive": "Archive task",
  "task.delete": "Delete task",

  // mobile context menu
  "menu.edit": "Edit",
  "menu.addSubtask": "Add subtask",
  "menu.insertLink": "Insert link",
  "menu.removeLink": "Remove link",
  "menu.setDueDate": "Set due date",
  "menu.moveTo": "Move to...",
  "menu.archive": "Archive",
  "menu.delete": "Delete",

  // list-selector.ts — tab context menu
  "menu.rename": "Rename",
  "menu.hideList": "Hide list",

  // subtask input
  "subtask.placeholder": "Add a subtask...",
  "subtask.ariaLabel": "New subtask text",

  // task-section.ts
  "section.empty": "No tasks yet. Add one above!",
  "section.completed": "Completed ({{count}})",
  "section.archiveAll": "Archive all completed",

  // task-input.ts
  "input.addToList": "Add to list",
  "input.taskPlaceholder": "Add a task...",
  "input.taskAriaLabel": "New task text",
  "input.dueDateLabel": "Due date for new task",
  "input.addButton": "Add",
  "input.addButtonLabel": "Add task",

  // list-selector.ts
  "tabs.all": "All",
  "tabs.allAriaLabel": "Show all lists",
  "tabs.switchTo": "Switch to {{name}}",
  "tabs.createNew": "Create new list",
  "tabs.renameLabel": "Rename list",

  // query-view-renderer.ts
  "query.task": "task",
  "query.tasks": "tasks",
  "query.empty": "No matching tasks",

  // query-parser.ts — describeQuery
  "query.allTasks": "All tasks",
  "query.dateToday": "today",
  "query.dateThisWeek": "this week",
  "query.dateThisMonth": "this month",
  "query.dateOn": "on {{date}}",
  "query.dateBefore": "before {{date}}",
  "query.dateAfter": "after {{date}}",
  "query.filterCompleted": "Completed {{when}}",
  "query.filterDue": "Due {{when}}",
  "query.filterOverdue": "Overdue",
  "query.filterIncomplete": "Incomplete",
  "query.filterList": "List: {{name}}",
  "query.filterTag": "Tag: #{{name}}",
  "query.unknownFilter": 'Unknown filter: "{{filter}}"',

  // todo-controller.ts — All view filter
  "allView.filterLists": "Filter lists",
  "allView.allHidden": "All lists are hidden",

  // todo-controller.ts — sort selector
  "sort.label": "Sort:",
  "sort.ariaLabel": "Sort tasks by",
  "sort.manual": "Manual",
  "sort.dueDate": "Due date",
  "sort.createdDate": "Created date",
  "sort.alphabetical": "Alphabetical",
  "sort.ascending": "Ascending",
  "sort.descending": "Descending",

  // settings.ts
  "settings.language.name": "Language",
  "settings.language.desc": "Override the display language. Leave as Auto to follow Obsidian's language setting.",
  "settings.language.auto": "Auto (follow Obsidian)",
  "settings.todoFolder.name": "Todo folder",
  "settings.todoFolder.desc": "Folder where todo list files are stored.",
  "settings.showCompleted.name": "Show completed tasks by default",
  "settings.showCompleted.desc": "Expand the completed tasks section by default.",
  "settings.autoComplete.name": "Auto-complete parent task",
  "settings.autoComplete.desc":
    "Automatically complete parent tasks when all subtasks are done.",
  "settings.defaultSort.name": "Default sort order",
  "settings.defaultSort.desc": "Sort order applied when opening a list. Can be overridden per-session using the sort selector in the panel.",
  "settings.openAllView.name": "Open All view by default",
  "settings.openAllView.desc": "Open the All view tab when activating ZenTodo from the ribbon or command.",

  // settings.ts — hidden lists
  "settings.hiddenLists.name": "Hidden lists",
  "settings.hiddenLists.desc": "Lists hidden from the sidebar. The underlying files are untouched.",
  "settings.hiddenLists.unhide": "Show",
  "settings.hiddenLists.empty": "No hidden lists.",

  // parser/markdown-parser.ts
  "parser.untitled": "Untitled",

  // todo-controller.ts — description
  "description.addPlaceholder": "Add description...",
};
