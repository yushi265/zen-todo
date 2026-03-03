# Working with Tasks

## Adding a Task

Type in the input field at the top of the view and press **Enter** or click **Add**.

### Setting a Due Date

Click the calendar icon next to the input field before submitting to set a due date. The due date appears as `📅 YYYY-MM-DD` in the Markdown file.

## Task Actions

Hover over any task to reveal action buttons on the right:

| Icon | Action | Availability |
|------|--------|-------------|
| ⠿ | Drag handle — drag to reorder | Always |
| 📅 | Set / change due date | Always |
| ➕ | Add subtask | Incomplete root tasks only |
| 🗃️ | Archive task | Completed root tasks only |
| 🗑️ | Delete task | Always |

## Completing a Task

Click the checkbox to mark a task complete. A completion date (`✅ YYYY-MM-DD`) is added automatically.

## Inline Editing

Click the task text to edit it inline. Press **Enter** to save or **Escape** to cancel.

## Subtasks

Click the **➕** icon on any incomplete root-level task to add a subtask beneath it. Subtasks are indented with a tab character in the Markdown file.

### Auto-Complete Parent

When the **Auto-Complete Parent** setting is enabled (default: on), completing all subtasks automatically marks the parent task complete. Reopening any subtask reopens the parent.

## Due Date Colors

Tasks with due dates are color-coded:

- **Red**: Overdue (past due date, not completed)
- **Orange/accent**: Due today
- **Normal**: Future due date
