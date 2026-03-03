# Settings

Open **Settings → ZenTodo** to configure the plugin.

## Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Todo Folder** | `30_ToDos` | Vault folder where list `.md` files are stored. Relative to vault root. Forward slashes are used regardless of OS. |
| **Show Completed by Default** | Off | When enabled, the completed tasks section is expanded when you open a list. |
| **Auto-Complete Parent Task** | On | When all subtasks of a parent task are completed, automatically marks the parent complete. Reopening any subtask also reopens the parent. |

## Changing the Todo Folder

1. Open **Settings → ZenTodo**.
2. Change the **Todo Folder** path.
3. Move your existing `.md` files to the new folder.

::: warning
ZenTodo only watches the configured folder. Files outside the folder are not shown or updated.
:::
