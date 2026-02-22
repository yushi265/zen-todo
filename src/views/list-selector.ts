import { setIcon, Platform } from "obsidian";
import { attachTabDrag } from "./tab-drag-handler";

// Persists across re-renders for dblclick detection (module-level scope is fine;
// only one tab bar is active at a time in practice)
let _lastTabClickMs = 0;
let _lastTabClickPath = "";
const DBLCLICK_MS = 400;

export function renderListSelector(
  container: HTMLElement,
  lists: { filePath: string; title: string }[],
  activeFilePath: string | null,
  onSelect: (filePath: string) => void,
  onCreateNew?: () => void,
  onReorder?: (orderedFilePaths: string[]) => void,
  onRename?: (filePath: string, newName: string) => void,
): void {
  container.empty();

  const tabsEl = container.createDiv({ cls: "zen-todo-tabs" });

  for (const list of lists) {
    const isActive = list.filePath === activeFilePath;
    const tab = tabsEl.createEl("button", {
      cls: `zen-todo-tab${isActive ? " is-active" : ""}`,
      text: list.title,
      attr: {
        "aria-label": `Switch to ${list.title}`,
        role: "tab",
        "aria-selected": String(isActive),
        "data-file-path": list.filePath,
      },
    });

    let suppressNextClick = false;

    tab.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (onRename && !Platform.isMobile) {
        const now = Date.now();
        if (now - _lastTabClickMs < DBLCLICK_MS && _lastTabClickPath === list.filePath) {
          _lastTabClickMs = 0;
          _lastTabClickPath = "";
          startTabRename(tab, tabsEl, list.filePath, list.title, onRename);
          return;
        }
        _lastTabClickMs = now;
        _lastTabClickPath = list.filePath;
      }
      onSelect(list.filePath);
    });

    if (onRename && Platform.isMobile) {
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let pointerStartX = 0;
      let pointerStartY = 0;

      tab.addEventListener("pointerdown", (e: PointerEvent) => {
        if (e.button !== 0) return;
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          suppressNextClick = true;
          startTabRename(tab, tabsEl, list.filePath, list.title, onRename!);
        }, 500);
      });

      const cancelLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      tab.addEventListener("pointermove", (e: PointerEvent) => {
        if (!longPressTimer) return;
        if (
          Math.abs(e.clientX - pointerStartX) > 5 ||
          Math.abs(e.clientY - pointerStartY) > 5
        ) {
          cancelLongPress();
        }
      });

      tab.addEventListener("pointerup", cancelLongPress);
      tab.addEventListener("pointercancel", cancelLongPress);
    }

    if (onReorder) {
      attachTabDrag(tab, tabsEl, onReorder);
    }
  }

  if (onCreateNew) {
    const newBtn = container.createEl("button", {
      cls: "zen-todo-new-list-btn",
      attr: {
        "aria-label": "Create new list",
        "data-tooltip-position": "top",
      },
    });
    setIcon(newBtn, "plus");
    newBtn.addEventListener("click", onCreateNew);
  }
}

function startTabRename(
  tab: HTMLElement,
  tabsEl: HTMLElement,
  filePath: string,
  title: string,
  onRename: (filePath: string, newName: string) => void,
): void {
  if (tabsEl.querySelector(".zen-todo-tab-rename-input")) return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "zen-todo-tab-rename-input";
  input.value = title;
  input.setAttribute("aria-label", "Rename list");
  tabsEl.insertBefore(input, tab);
  tab.style.display = "none";

  let done = false;

  const confirm = () => {
    if (done) return;
    done = true;
    const newName = input.value.trim();
    input.remove();
    tab.style.display = "";
    if (newName && newName !== title) {
      onRename(filePath, newName);
    }
  };

  const cancel = () => {
    if (done) return;
    done = true;
    input.remove();
    tab.style.display = "";
  };

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      e.stopPropagation();
      confirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  });

  input.addEventListener("blur", confirm);

  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}
