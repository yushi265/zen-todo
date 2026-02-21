# ZenTodo

A minimalist todo manager for [Obsidian](https://obsidian.md) that stores tasks as plain Markdown — fully compatible with the [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks) format.

## Features

- **Multiple Lists** — Create and switch between separate todo list files
- **Subtasks** — Nest tasks with automatic indentation tracking
- **Due Dates** — Set due dates with color-coded status (overdue / today)
- **Tasks-Plugin Compatible Format** — Uses standard `📅` / `✅` emoji markers in Markdown so files remain readable by the Tasks plugin
- **Auto-Complete Parent** — Optionally mark parent tasks complete when all subtasks are done
- **Inline Editing** — Click any task to edit text directly in the UI
- **External Sync** — Detects file changes made by other plugins or external editors and refreshes automatically
- **Collapsible Completed Section** — Keep your workspace tidy by hiding done tasks

## Screenshot

<!-- TODO: add screenshot -->

## Installation

### Manual (until listed in the Community Plugins directory)

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/yushi265/zen-todo/releases).
2. Copy them into your vault at `.obsidian/plugins/zen-todo/`.
3. Reload Obsidian and enable **ZenTodo** in **Settings → Community Plugins**.

### BRAT (Beta Reviewers Auto-update Tool)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. Run **BRAT: Add a beta plugin** and enter `yushi265/zen-todo`.

## Usage

Open ZenTodo via:

- The **checkbox icon** in the ribbon (left sidebar)
- Command palette: `ZenTodo: Open todo list`

### Managing Lists

Click **+** in the tab bar to create a new list. Each list is stored as a separate `.md` file in your configured todo folder.

### Adding Tasks

Type in the input field at the top of the view and press **Enter** or click **Add**. Optionally set a due date before submitting.

### Subtasks

Click the **+** icon on any root-level task to add a subtask beneath it.

### Task Actions (hover to reveal)

| Icon | Action |
|------|--------|
| 📅 | Set / change due date |
| ➕ | Add subtask |
| 🗑️ | Delete task |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Save task text / add task |
| `Escape` | Cancel inline edit |

## Markdown Format

Tasks are stored as standard Markdown checkboxes. The format is intentionally kept compatible with the [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks):

```markdown
# Shopping List

- [ ] Buy milk 📅 2026-03-01
	- [x] Check expiry date ✅ 2026-02-22
- [x] Return library books ✅ 2026-02-20
```

| Element | Meaning |
|---------|---------|
| `- [ ]` | Incomplete task |
| `- [x]` | Completed task |
| Tab indentation | Subtask nesting |
| `📅 YYYY-MM-DD` | Due date |
| `✅ YYYY-MM-DD` | Completion date |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Todo Folder** | `30_ToDos` | Vault folder where list files are stored |
| **Show Completed by Default** | Off | Expand the completed section on load |
| **Auto-Complete Parent Task** | On | Complete parent when all subtasks are done; reopen it when any subtask is reopened |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

### Setup

```bash
git clone https://github.com/yushi265/zen-todo.git
cd zen-todo
pnpm install
```

### Build

```bash
# Development build with watch mode
pnpm dev

# Production build (includes type checking)
pnpm build
```

The output files (`main.js`, `manifest.json`, `styles.css`) can be copied directly into your vault's `.obsidian/plugins/zen-todo/` folder.

### Project Structure

```
src/
├── main.ts                    # Plugin entry point & Obsidian lifecycle
├── settings.ts                # Settings UI tab
├── types.ts                   # TypeScript interfaces
├── constants.ts               # Defaults, view type ID, emoji markers
├── models/
│   └── task.ts                # Task creation and mutation helpers
├── parser/
│   ├── markdown-parser.ts     # Markdown → task object tree
│   └── markdown-serializer.ts # Task object tree → Markdown
├── utils/
│   └── date-utils.ts          # Date formatting and comparison
└── views/
    ├── todo-view.ts           # Main view controller & state management
    ├── list-selector.ts       # Tab bar for list switching
    ├── task-input.ts          # New task input row
    ├── task-section.ts        # Incomplete / completed section rendering
    └── task-item-renderer.ts  # Individual task row + inline edit
```

## Contributing

Bug reports and pull requests are welcome. Please open an issue first for significant changes.

## License

[MIT](LICENSE)
