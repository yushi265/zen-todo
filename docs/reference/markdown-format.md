# Markdown Format

ZenTodo stores tasks as standard Markdown checkboxes, intentionally compatible with the [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks).

## Example

```markdown
# Shopping List

- [ ] Buy milk 📅 2026-03-01
	- [x] Check expiry date ✅ 2026-02-22
- [x] Return library books ✅ 2026-02-20

## Archived

- [x] Old completed task ✅ 2026-01-15
```

## Format Elements

| Element | Meaning |
|---------|---------|
| `- [ ]` | Incomplete task |
| `- [x]` | Completed task |
| Tab indentation | Subtask nesting (always tabs, never spaces) |
| `📅 YYYY-MM-DD` | Due date |
| `✅ YYYY-MM-DD` | Completion date |
| `## Archived` section | Archived completed tasks (preserved verbatim) |

## Ordering

The serializer always writes:
1. Incomplete tasks first
2. Completed tasks last

This applies at both the root level and within subtask groups.

## Archived Section

The `## Archived` heading at the end of the file stores archived tasks. This section is:
- Parsed into `TodoList.archivedSection` when reading
- **Preserved verbatim** on every save — ZenTodo never modifies its contents

## iOS Compatibility

The parser avoids lookbehind regex to maintain compatibility with iOS < 16.4.
