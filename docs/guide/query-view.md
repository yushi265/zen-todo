# Query View

## What Is Query View?

Writing a filter expression inside a `zen-todo` code block displays filtered task results from all your lists inline. An **empty** code block renders the full interactive panel instead.

## Quick Start

Copy any of these into a code block to get started:

**Tasks completed today**

````markdown
```zen-todo
completed today
```
````

**Overdue tasks**

````markdown
```zen-todo
overdue
```
````

**Tasks due this week**

````markdown
```zen-todo
due this week
```
````

## Filter Reference

### Completion Filters

| Filter | Description |
|--------|-------------|
| `completed today` | Tasks completed today |
| `completed this week` | Tasks completed this week |
| `completed this month` | Tasks completed this month |
| `completed YYYY-MM-DD` | Tasks completed on a specific date (e.g. `completed 2026-03-01`) |
| `completed before YYYY-MM-DD` | Tasks completed before a specific date |
| `completed after YYYY-MM-DD` | Tasks completed after a specific date |

### Due Date Filters

| Filter | Description |
|--------|-------------|
| `due today` | Tasks due today |
| `due this week` | Tasks due this week |
| `due this month` | Tasks due this month |
| `due YYYY-MM-DD` | Tasks due on a specific date (e.g. `due 2026-03-15`) |
| `due before YYYY-MM-DD` | Tasks due before a specific date |
| `due after YYYY-MM-DD` | Tasks due after a specific date |

### Status Filters

| Filter | Description |
|--------|-------------|
| `overdue` | Incomplete tasks past their due date |
| `incomplete` | All incomplete tasks |
| `not completed` | Alias for `incomplete` |

### List Filter

| Filter | Description |
|--------|-------------|
| `list: Work` | Tasks from lists whose title contains "Work" (case-insensitive) |
| `list: "Daily Tasks"` | List names with spaces (wrap in quotes) |

### Comments

Lines starting with `#` are ignored:

```
# Today's review
completed today
```

## Combining Filters

Multiple filters on separate lines are combined with **AND**:

**Overdue tasks in the Work list**

````markdown
```zen-todo
overdue
list: Work
```
````

**Tasks completed this month in the Work list**

````markdown
```zen-todo
completed this month
list: Work
```
````

**Incomplete tasks due this week**

````markdown
```zen-todo
due this week
incomplete
```
````

## Behavior Notes

- **Empty code block** → full interactive panel (add, edit, archive tasks)
- **Code block with text** → query mode (read-only + checkbox toggle)
- **Checkbox** toggles task completion directly. Changes are saved to the source `.md` file immediately.
- **External changes are reflected automatically** after a 300 ms debounce.
- **Unrecognized lines show an error** — `Unknown filter: "..."` displayed in red below the header.
- **Results are grouped by list** — each group shows a description and hit count in the header.
