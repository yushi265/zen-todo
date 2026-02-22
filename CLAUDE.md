# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

ZenTodo is an [Obsidian](https://obsidian.md) plugin written in TypeScript. It provides a minimalist, panel-based todo manager that stores tasks as plain Markdown in a Tasks-plugin-compatible format.

**Key constraints:**
- No external runtime dependencies beyond the Obsidian API
- All CSS must use Obsidian CSS variables (no hardcoded colors)
- Markdown storage format must remain compatible with the Tasks plugin

## Architecture

```
src/
├── main.ts                    # ZenTodoPlugin: onload / onunload, ribbon, commands
├── settings.ts                # ZenTodoSettingTab: settings UI (ItemView-based)
├── types.ts                   # TaskItem, TodoList, ZenTodoSettings interfaces
├── constants.ts               # DEFAULT_SETTINGS, VIEW_TYPE_ZEN_TODO, emoji markers
├── models/
│   └── task.ts                # Pure functions: createTask, completeTask, cleanTaskText, etc.
├── parser/
│   ├── markdown-parser.ts     # parseMarkdown(): Markdown string → { title, tasks, archivedSection }
│   └── markdown-serializer.ts # serializeToMarkdown(): TodoList → Markdown string; serializeTaskToLines(): single task → lines
├── utils/
│   └── date-utils.ts          # formatDate, today, isOverdue, isToday
└── views/
    ├── todo-view.ts           # ZenTodoView (ItemView): thin wrapper that hosts a ZenTodoController
    ├── todo-controller.ts     # ZenTodoController: state + action dispatch (shared by view and code block)
    ├── codeblock-processor.ts # ZenTodoCodeBlockChild (MarkdownRenderChild): inline embedded view
    ├── list-selector.ts       # renderListSelector(): tab bar
    ├── task-input.ts          # renderTaskInput(): new task row
    ├── task-section.ts        # renderTaskSection(): incomplete / completed groups
    ├── task-item-renderer.ts  # renderTaskItem(): single row + inline edit
    ├── drag-handler.ts        # attachDragHandle(): pointer-based task drag & drop reorder
    └── tab-drag-handler.ts    # attachTabDrag(): pointer-based list-tab drag & drop reorder
```

### Data Flow

```
Vault (.md file)
  → parseTodoMarkdown()      → TodoList (in-memory)
  → ZenTodoController.render() → DOM
  ← TaskActionEvent            ← user interaction
  → task model mutations
  → serializeTodoList()      → Markdown string
  → vault.process()          → Vault (.md file)
```

### Controller / View separation

`ZenTodoController` (`todo-controller.ts`) holds all state and business logic. It is instantiated in two contexts:

| Context | Host |
|---------|------|
| Sidebar panel | `ZenTodoView` (ItemView) |
| Inline code block | `ZenTodoCodeBlockChild` (MarkdownRenderChild) |

Both contexts call `controller.initialize()` and `controller.onExternalChange()`. The plugin (`main.ts`) notifies every active view **and** every embedded controller when a todo file changes.

### State (ZenTodoController)

| Field | Type | Purpose |
|-------|------|---------|
| `lists` | `TodoList[]` | All loaded todo lists |
| `activeFilePath` | `string \| null` | Currently selected list |
| `addingSubtaskFor` | `string \| null` | Task ID receiving a new subtask |
| `editingNotesFor` | `string \| null` | Task ID whose notes textarea is open |
| `isSaving` | `boolean` | Lock to prevent concurrent writes |
| `isDragging` | `boolean` | True while a drag is in progress (suppresses external-change refresh) |
| `refreshTimer` | `NodeJS.Timeout \| null` | Debounce handle for external changes |
| `shouldFocusTaskInput` | `boolean` | One-shot flag to focus the task input after add |

### Drag & Drop Reorder (`drag-handler.ts`)

`attachDragHandle()` attaches a pointer-event-based drag handle to each task row:

- **Scope**: reorders tasks within the same section only (incomplete ↔ incomplete, completed ↔ completed — never across sections)
- **Visual feedback**: dragged item fades (`is-dragging`), a clone follows the cursor (`zen-todo-drag-clone`), a drop indicator line shows the insertion point (`zen-todo-drop-indicator`)
- **Auto-scroll**: scrolls the `.zen-todo-content` container when the cursor nears the top/bottom edge
- **Cancel**: `Escape` key cancels drag without reordering
- `onReorder(orderedIds)` callback is called only when the result differs from the original order (skipped for single-item groups)

### Tab Drag & Drop Reorder (`tab-drag-handler.ts`)

`attachTabDrag()` attaches a pointer-event-based drag to each list tab:

- **Visual feedback**: dragged tab fades (`is-dragging`), a clone mirrors it (`zen-todo-tab-drag-clone`), a vertical indicator line shows the insertion point (`zen-todo-tab-drop-indicator`)
- **Cancel**: `Escape` key cancels drag without reordering
- `onReorder(orderedFilePaths)` callback saves the new order to `settings.listOrder` via `ZenTodoController.reorderLists()`

### Inline Embedded View (`codeblock-processor.ts`)

Registering a `zen-todo` fenced code block in any note renders a full ZenTodo panel inline:

````markdown
```zen-todo
```
````

- `ZenTodoCodeBlockChild` extends `MarkdownRenderChild` and manages its own `ZenTodoController` instance
- The plugin registers embedded controllers in `embeddedControllers` set so they receive `onExternalChange` notifications alongside the sidebar view
- The code block content (source) is currently ignored; all lists in the configured folder are loaded

## Markdown Format

```markdown
# List Title

- [ ] Incomplete task 📅 2026-03-01
	Note text for this task (indented, non-checkbox line)
	- [x] Completed subtask ✅ 2026-02-20
- [x] Completed task ✅ 2026-02-22

## Archived

- [x] Old archived task ✅ 2026-01-10
```

- **Tab indentation** for subtask nesting (never spaces)
- `📅 YYYY-MM-DD` — due date marker (defined in `constants.ts`)
- `✅ YYYY-MM-DD` — completion date marker
- **Notes**: indented non-checkbox lines immediately below a task are parsed into `TaskItem.notes`; serialized one indent level deeper than the task
- **Archived section**: `## Archived` heading at the end of the file stores archived tasks as raw Markdown; parsed into `TodoList.archivedSection` and preserved verbatim on every save
- Serializer always orders: incomplete tasks first, completed tasks last (both at root and subtask levels)
- Parser uses a **stack-based algorithm** and avoids lookbehind regex for iOS < 16.4 compatibility

## Development Commands

```bash
pnpm install   # install dependencies
pnpm dev       # watch build (esbuild)
pnpm build     # production build + tsc type check
```

Output files: `main.js`, `manifest.json`, `styles.css`

To test locally, symlink or copy these three files into your vault:
```
<vault>/.obsidian/plugins/zen-todo/
```

## Key Conventions

### TypeScript

- Strict null checks are enabled; always handle `null` / `undefined`
- Use `createTaskId()` (timestamp + counter) for new task IDs — never use `Math.random()`
- Task text stored in `TaskItem.text` must be **clean** (no emoji markers); call `cleanTaskText()` before storing

### CSS

- All selectors scoped under `.zen-todo-view` or modal class names to prevent conflicts
- Use Obsidian CSS variables only: `var(--color-accent)`, `var(--text-muted)`, etc.
- No hardcoded hex / rgb values

### File Operations

- Always check `isSaving` before writing; set it to `true` and release in `finally`
- Debounce external change events with a 300 ms timer before re-parsing
- Use `vault.process()` for updates (preferred over `vault.modify()`); never delete and recreate a file

### View Rendering

- `ZenTodoController` re-renders the entire container on every state change (simple full re-render strategy)
- Event listeners are attached after DOM construction — no persistent references stored outside the closure
- Inline edit state is managed by `addingSubtaskFor` / `editingNotesFor` in the controller; only one input is open at a time

## Settings

Defined in `types.ts` as `ZenTodoSettings` and defaulted in `constants.ts`:

| Key | Default | Notes |
|-----|---------|-------|
| `todoFolder` | `"30_ToDos"` | Normalized to forward slashes |
| `showCompletedByDefault` | `false` | |
| `autoCompleteParent` | `true` | |
| `listOrder` | `[]` | Ordered array of file paths; persisted to plugin data |

## Obsidian API Notes

- Register all event listeners via `this.registerEvent()` so they are cleaned up on unload
- Use `this.app.vault.getFiles()` to enumerate files (works across all Obsidian versions)
- `ItemView.onOpen()` / `onClose()` are the correct lifecycle hooks for view setup/teardown
- `MarkdownRenderChild.onload()` / `onunload()` are the lifecycle hooks for code block processors
- Never call `leaf.detach()` on leaves you did not create; use `leaf.view` checks before interacting

## Common Tasks

### Add a new setting

1. Add the key and type to `ZenTodoSettings` in `types.ts`
2. Add the default value to `DEFAULT_SETTINGS` in `constants.ts`
3. Add the UI control in `ZenTodoSettingTab.display()` in `settings.ts`
4. Consume the setting in the relevant view or model

### Add a new task action

1. Add the action type to `TaskActionType` union in `task-item-renderer.ts`
2. Add a button/handler in `task-item-renderer.ts`
3. Handle the `TaskActionEvent` in `ZenTodoController.handleTaskAction()` in `todo-controller.ts`
4. Add a pure function for any data mutation in `models/task.ts`
