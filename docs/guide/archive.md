# Archiving Tasks

## What Is Archiving?

Archiving moves completed tasks to a preserved `## Archived` section at the bottom of the list file. Archived tasks are kept in the file but removed from the active task view.

## How to Archive

Hover over any **completed root-level task** and click the **🗃️** (archive) icon.

The task is moved to the `## Archived` section at the bottom of the `.md` file:

```markdown
## Archived

- [x] Old completed task ✅ 2026-01-15
```

## Notes

- Only **completed root-level tasks** can be archived (subtasks cannot be archived directly).
- The `## Archived` section is preserved verbatim on every save — its contents are never modified by ZenTodo.
- Archived tasks do not appear in the active task view or query results.
