# Inline Embedded View

## Embedding ZenTodo in a Note

Add a `zen-todo` fenced code block anywhere in your notes to embed a ZenTodo panel inline:

````markdown
```zen-todo
```
````

This renders a full interactive ZenTodo panel — the same lists and actions available in the sidebar panel.

## Query Mode

Write filter expressions in the code block to display filtered task results across all lists:

````markdown
```zen-todo
completed today
```
````

In query mode, you can toggle task completion directly from the embedded view. Changes are saved to the source `.md` file immediately.

See [Query View](./query-view) for the full filter reference.

## Notes

- Multiple embedded views in the same note each maintain their own state.
- The embedded view receives external change notifications — if a todo file is modified externally, the embedded view refreshes automatically (300 ms debounce).
- An empty code block → full interactive panel.
- A code block with filter text → read-only query results with checkbox toggle.
