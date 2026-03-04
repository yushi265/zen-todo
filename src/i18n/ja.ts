import type { TranslationKeys } from "./types";

export const ja: TranslationKeys = {
  // main.ts
  "ribbon.openZenTodo": "ZenTodo を開く",
  "command.openTodoList": "Todo リストを開く",
  "command.createNewList": "新しい Todo リストを作成",

  // date-utils.ts
  "date.today": "今日",
  "date.yesterday": "昨日",
  "date.daysAgo": "{{count}}日前",
  "date.oneWeekAgo": "1週間前",
  "date.twoWeeksAgo": "2週間前",
  "date.threeWeeksAgo": "3週間前",
  "date.monthsAgo": "{{count}}ヶ月前",
  "date.yearsAgo": "{{count}}年前",

  // todo-controller.ts — undo messages
  "undo.moved": "「{{name}}」を移動しました",
  "undo.completed": "「{{name}}」を完了しました",
  "undo.uncompleted": "「{{name}}」を未完了に戻しました",
  "undo.deleted": "「{{name}}」を削除しました",
  "undo.archived": "「{{name}}」をアーカイブしました",
  "undo.archivedAll": "{{count}}件の完了済みタスクをアーカイブしました",
  "undo.button": "元に戻す",

  // todo-controller.ts — empty state
  "noLists.message": "Todo リストが見つかりません。",
  "noLists.hint": "+ を押してリストを作成するか、{{folder}}/ に .md ファイルを追加してください",

  // new list modal
  "modal.newList.title": "新しい Todo リストを作成",
  "modal.newList.placeholder": "リスト名...",
  "modal.newList.ariaLabel": "リスト名",
  "modal.newList.submit": "作成",

  // remove link modal
  "modal.removeLink.title": "リンクを削除",
  "modal.removeLink.message": "「{{name}}」のリンク先ノートをゴミ箱に移動し、リンクを解除しますか？",
  "modal.removeLink.cancel": "キャンセル",
  "modal.removeLink.confirm": "削除",

  // task-item-renderer.ts — aria labels
  "task.markComplete": "完了にする",
  "task.markIncomplete": "未完了に戻す",
  "task.editLabel": "タスクを編集",
  "task.editInputLabel": "タスクのテキストを編集",
  "task.dueDateLabel": "期日",
  "task.setDueDate": "期日を設定",
  "task.insertLink": "リンクを挿入",
  "task.removeLink": "リンクを削除",
  "task.addSubtask": "サブタスクを追加",
  "task.moveToList": "リストへ移動",
  "task.archive": "アーカイブ",
  "task.delete": "削除",

  // mobile context menu
  "menu.edit": "編集",
  "menu.addSubtask": "サブタスクを追加",
  "menu.insertLink": "リンクを挿入",
  "menu.removeLink": "リンクを削除",
  "menu.setDueDate": "期日を設定",
  "menu.moveTo": "移動先...",
  "menu.archive": "アーカイブ",
  "menu.delete": "削除",

  // subtask input
  "subtask.placeholder": "サブタスクを追加...",
  "subtask.ariaLabel": "新しいサブタスクのテキスト",

  // task-section.ts
  "section.empty": "タスクがありません。上のフォームから追加してください！",
  "section.completed": "完了済み ({{count}})",
  "section.archiveAll": "完了済みをすべてアーカイブ",

  // task-input.ts
  "input.addToList": "追加先リスト",
  "input.taskPlaceholder": "タスクを追加...",
  "input.taskAriaLabel": "新しいタスクのテキスト",
  "input.dueDateLabel": "新しいタスクの期日",
  "input.addButton": "追加",
  "input.addButtonLabel": "タスクを追加",

  // list-selector.ts
  "tabs.all": "すべて",
  "tabs.allAriaLabel": "すべてのリストを表示",
  "tabs.switchTo": "{{name}} に切り替え",
  "tabs.createNew": "新しいリストを作成",
  "tabs.renameLabel": "リストの名前を変更",

  // query-view-renderer.ts
  "query.task": "件",
  "query.tasks": "件",
  "query.empty": "一致するタスクはありません",

  // query-parser.ts — describeQuery
  "query.allTasks": "すべてのタスク",
  "query.dateToday": "今日",
  "query.dateThisWeek": "今週",
  "query.dateThisMonth": "今月",
  "query.dateOn": "{{date}}",
  "query.dateBefore": "{{date}} より前",
  "query.dateAfter": "{{date}} より後",
  "query.filterCompleted": "完了 {{when}}",
  "query.filterDue": "期日 {{when}}",
  "query.filterOverdue": "期限切れ",
  "query.filterIncomplete": "未完了",
  "query.filterList": "リスト: {{name}}",
  "query.unknownFilter": "不明なフィルター: \"{{filter}}\"",

  // todo-controller.ts — sort selector
  "sort.label": "並び替え:",
  "sort.ariaLabel": "タスクの並び替え",
  "sort.manual": "手動",
  "sort.dueDate": "期日順",
  "sort.createdDate": "作成日順",
  "sort.alphabetical": "名前順",

  // settings.ts
  "settings.language.name": "言語",
  "settings.language.desc": "表示言語を上書きします。「自動」にすると Obsidian の言語設定に従います。",
  "settings.language.auto": "自動（Obsidian に従う）",
  "settings.todoFolder.name": "Todo フォルダー",
  "settings.todoFolder.desc": "Todo リストファイルを保存するフォルダー。",
  "settings.showCompleted.name": "完了済みタスクをデフォルトで表示",
  "settings.showCompleted.desc": "完了済みタスクのセクションをデフォルトで展開します。",
  "settings.autoComplete.name": "親タスクを自動完了",
  "settings.autoComplete.desc":
    "すべてのサブタスクが完了したとき、親タスクを自動的に完了にします。",
  "settings.defaultSort.name": "デフォルトの並び順",
  "settings.defaultSort.desc": "リストを開いたときに適用される並び順。パネル内のソートセレクターでセッション中に変更できます。",

  // parser/markdown-parser.ts
  "parser.untitled": "無題",

  // todo-controller.ts — description
  "description.addPlaceholder": "概要を追加...",
};
