export interface TranslationKeys {
  // main.ts
  "ribbon.openZenTodo": string;
  "command.openTodoList": string;
  "command.createNewList": string;
  "command.openAllView": string;

  // date-utils.ts
  "date.today": string;
  "date.yesterday": string;
  "date.daysAgo": string;
  "date.oneWeekAgo": string;
  "date.twoWeeksAgo": string;
  "date.threeWeeksAgo": string;
  "date.monthsAgo": string;
  "date.yearsAgo": string;

  // todo-controller.ts — undo messages
  "undo.moved": string;
  "undo.completed": string;
  "undo.uncompleted": string;
  "undo.deleted": string;
  "undo.archived": string;
  "undo.archivedAll": string;
  "undo.reparented": string;
  "undo.unparented": string;
  "undo.button": string;

  // todo-controller.ts — empty state
  "noLists.message": string;
  "noLists.hint": string;

  // todo-controller.ts — new list modal
  "modal.newList.title": string;
  "modal.newList.placeholder": string;
  "modal.newList.ariaLabel": string;
  "modal.newList.submit": string;

  // todo-controller.ts — remove link modal
  "modal.removeLink.title": string;
  "modal.removeLink.message": string;
  "modal.removeLink.cancel": string;
  "modal.removeLink.confirm": string;

  // task-item-renderer.ts — aria labels
  "task.markComplete": string;
  "task.markIncomplete": string;
  "task.editLabel": string;
  "task.editInputLabel": string;
  "task.dueDateLabel": string;
  "task.setDueDate": string;
  "task.insertLink": string;
  "task.removeLink": string;
  "task.addSubtask": string;
  "task.moveToList": string;
  "task.archive": string;
  "task.delete": string;

  // task-item-renderer.ts — mobile context menu
  "menu.edit": string;
  "menu.addSubtask": string;
  "menu.insertLink": string;
  "menu.removeLink": string;
  "menu.setDueDate": string;
  "menu.moveTo": string;
  "menu.archive": string;
  "menu.delete": string;

  // task-item-renderer.ts — subtask input
  "subtask.placeholder": string;
  "subtask.ariaLabel": string;

  // task-section.ts
  "section.empty": string;
  "section.completed": string;
  "section.archiveAll": string;

  // task-input.ts
  "input.addToList": string;
  "input.taskPlaceholder": string;
  "input.taskAriaLabel": string;
  "input.dueDateLabel": string;
  "input.addButton": string;
  "input.addButtonLabel": string;

  // list-selector.ts
  "tabs.all": string;
  "tabs.allAriaLabel": string;
  "tabs.switchTo": string;
  "tabs.createNew": string;
  "tabs.renameLabel": string;

  // query-view-renderer.ts
  "query.task": string;
  "query.tasks": string;
  "query.empty": string;

  // query-parser.ts — describeQuery / describeDateFilter
  "query.allTasks": string;
  "query.dateToday": string;
  "query.dateThisWeek": string;
  "query.dateThisMonth": string;
  "query.dateOn": string;
  "query.dateBefore": string;
  "query.dateAfter": string;
  "query.filterCompleted": string;
  "query.filterDue": string;
  "query.filterOverdue": string;
  "query.filterIncomplete": string;
  "query.filterList": string;
  "query.unknownFilter": string;

  // todo-controller.ts — All view filter
  "allView.filterLists": string;
  "allView.allHidden": string;

  // todo-controller.ts — sort selector
  "sort.label": string;
  "sort.ariaLabel": string;
  "sort.manual": string;
  "sort.dueDate": string;
  "sort.createdDate": string;
  "sort.alphabetical": string;
  "sort.ascending": string;
  "sort.descending": string;

  // settings.ts
  "settings.language.name": string;
  "settings.language.desc": string;
  "settings.language.auto": string;
  "settings.todoFolder.name": string;
  "settings.todoFolder.desc": string;
  "settings.showCompleted.name": string;
  "settings.showCompleted.desc": string;
  "settings.autoComplete.name": string;
  "settings.autoComplete.desc": string;
  "settings.defaultSort.name": string;
  "settings.defaultSort.desc": string;
  "settings.openAllView.name": string;
  "settings.openAllView.desc": string;

  // parser/markdown-parser.ts
  "parser.untitled": string;

  // todo-controller.ts — description
  "description.addPlaceholder": string;
}
