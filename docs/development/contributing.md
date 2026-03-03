# Contributing

Bug reports and pull requests are welcome. Please open an issue first for significant changes.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

## Setup

```bash
git clone https://github.com/yushi265/zen-todo.git
cd zen-todo
pnpm install
```

## Build

```bash
# Development build with watch mode
pnpm dev

# Production build (includes type checking)
pnpm build
```

Output files (`main.js`, `manifest.json`, `styles.css`) can be copied into your vault's `.obsidian/plugins/zen-todo/` folder.

## Project Structure

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
    ├── todo-view.ts           # Sidebar panel (ItemView wrapper)
    ├── todo-controller.ts     # State management & action dispatch
    ├── codeblock-processor.ts # Inline embedded view (MarkdownRenderChild)
    ├── list-selector.ts       # Tab bar for list switching
    ├── task-input.ts          # New task input row
    ├── task-section.ts        # Incomplete / completed section rendering
    ├── task-item-renderer.ts  # Individual task row + inline edit
    ├── drag-handler.ts        # Task row drag & drop reorder
    └── tab-drag-handler.ts    # List tab drag & drop reorder
```

## Architecture Overview

See [CLAUDE.md](https://github.com/yushi265/zen-todo/blob/main/CLAUDE.md) for detailed architecture documentation.

## License

[MIT](https://github.com/yushi265/zen-todo/blob/main/LICENSE)
