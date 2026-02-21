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
│   ├── markdown-parser.ts     # parseTodoMarkdown(): Markdown string → TodoList
│   └── markdown-serializer.ts # serializeTodoList(): TodoList → Markdown string
├── utils/
│   └── date-utils.ts          # formatDate, today, isOverdue, isToday
└── views/
    ├── todo-view.ts           # ZenTodoView (ItemView): state + action dispatch
    ├── list-selector.ts       # renderListSelector(): tab bar
    ├── task-input.ts          # renderTaskInput(): new task row
    ├── task-section.ts        # renderTaskSection(): incomplete / completed groups
    └── task-item-renderer.ts  # renderTaskItem(): single row + inline edit
```

### Data Flow

```
Vault (.md file)
  → parseTodoMarkdown()   → TodoList (in-memory)
  → ZenTodoView (render)  → DOM
  ← TaskActionEvent       ← user interaction
  → task model mutations
  → serializeTodoList()   → Markdown string
  → vault.modify()        → Vault (.md file)
```

### State (ZenTodoView)

| Field | Type | Purpose |
|-------|------|---------|
| `lists` | `TodoList[]` | All loaded todo lists |
| `activeFilePath` | `string \| null` | Currently selected list |
| `addingSubtaskFor` | `string \| null` | Task ID receiving a new subtask |
| `isSaving` | `boolean` | Lock to prevent concurrent writes |
| `refreshTimer` | `NodeJS.Timeout \| null` | Debounce handle for external changes |

## Markdown Format

```markdown
# List Title

- [ ] Incomplete task 📅 2026-03-01
	- [x] Completed subtask ✅ 2026-02-20
- [x] Completed task ✅ 2026-02-22
```

- **Tab indentation** for subtask nesting (never spaces)
- `📅 YYYY-MM-DD` — due date marker (defined in `constants.ts`)
- `✅ YYYY-MM-DD` — completion date marker
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
- Use `vault.modify()` for updates; never delete and recreate a file

### View Rendering

- ZenTodoView re-renders the entire view on every state change (simple full re-render strategy)
- Event listeners are attached after DOM construction inside `onOpen()` scope — no persistent references
- Inline edit state is managed by `addingSubtaskFor` in the view; only one subtask input is open at a time

## Settings

Defined in `types.ts` as `ZenTodoSettings` and defaulted in `constants.ts`:

| Key | Default | Notes |
|-----|---------|-------|
| `todoFolder` | `"30_ToDos"` | Normalized to forward slashes |
| `showCompletedByDefault` | `false` | |
| `autoCompleteParent` | `true` | |

## Obsidian API Notes

- Register all event listeners via `this.registerEvent()` so they are cleaned up on unload
- Use `this.app.vault.getMarkdownFiles()` to enumerate todo files
- `ItemView.onOpen()` / `onClose()` are the correct lifecycle hooks for view setup/teardown
- Never call `leaf.detach()` on leaves you did not create; use `leaf.view` checks before interacting

## Common Tasks

### Add a new setting

1. Add the key and type to `ZenTodoSettings` in `types.ts`
2. Add the default value to `DEFAULT_SETTINGS` in `constants.ts`
3. Add the UI control in `ZenTodoSettingTab.display()` in `settings.ts`
4. Consume the setting in the relevant view or model

### Add a new task action

1. Add the action type to `TaskActionType` union in `types.ts`
2. Add a button/handler in `task-item-renderer.ts`
3. Handle the `TaskActionEvent` in `ZenTodoView.handleTaskAction()` in `todo-view.ts`
4. Add a pure function for any data mutation in `models/task.ts`
