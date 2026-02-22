import { setIcon } from "obsidian";

interface DragState {
	taskItemEl: HTMLElement;
	startY: number;
	handleOffsetY: number;
	isDragging: boolean;
	cloneEl: HTMLElement | null;
	indicatorEl: HTMLElement | null;
	siblings: HTMLElement[];
	dropIndex: number;
	autoScrollTimer: number | null;
	keydownHandler: ((e: KeyboardEvent) => void) | null;
}

export function attachDragHandle(
	taskItemEl: HTMLElement,
	taskRowEl: HTMLElement,
	dropContainer: HTMLElement,
	_taskId: string,
	onReorder: (orderedIds: string[]) => void,
	onDragStateChange?: (dragging: boolean) => void
): void {
	const handleEl = createEl("div", { cls: "zen-todo-drag-handle" });
	setIcon(handleEl, "grip-vertical");
	taskRowEl.insertBefore(handleEl, taskRowEl.firstChild);

	let state: DragState | null = null;

	handleEl.addEventListener("pointerdown", (e: PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		handleEl.setPointerCapture(e.pointerId);
		const rect = taskItemEl.getBoundingClientRect();
		state = {
			taskItemEl,
			startY: e.clientY,
			handleOffsetY: e.clientY - rect.top,
			isDragging: false,
			cloneEl: null,
			indicatorEl: null,
			siblings: [],
			dropIndex: 0,
			autoScrollTimer: null,
			keydownHandler: null,
		};
	});

	handleEl.addEventListener("pointermove", (e: PointerEvent) => {
		if (!state) return;
		const dy = Math.abs(e.clientY - state.startY);

		if (!state.isDragging) {
			if (dy < 5) return;
			// --- begin drag ---
			state.isDragging = true;
			onDragStateChange?.(true);

			// Escape key cancels drag
			const keydownHandler = (ev: KeyboardEvent) => {
				if (ev.key === "Escape" && state) {
					cleanup(state, dropContainer);
					state = null;
					onDragStateChange?.(false);
				}
			};
			state.keydownHandler = keydownHandler;
			document.addEventListener("keydown", keydownHandler);

			// Collect same-completed siblings (excluding the dragged item)
			const sameCompleted = taskItemEl.classList.contains("is-completed");
			state.siblings = Array.from(
				dropContainer.querySelectorAll(":scope > .zen-todo-task-item")
			).filter(
				(el) =>
					el !== taskItemEl &&
					el.classList.contains("is-completed") === sameCompleted
			) as HTMLElement[];

			taskItemEl.addClass("is-dragging");
			dropContainer.style.position = "relative";

			// Clone (first row only for visual)
			const cloneEl = dropContainer.createDiv({ cls: "zen-todo-drag-clone" });
			const firstRow = taskItemEl.querySelector(".zen-todo-task-row");
			if (firstRow) {
				cloneEl.appendChild(firstRow.cloneNode(true));
			}
			cloneEl.style.height = taskItemEl.getBoundingClientRect().height + "px";
			state.cloneEl = cloneEl;

			// Drop indicator
			state.indicatorEl = dropContainer.createDiv({ cls: "zen-todo-drop-indicator" });

			// Reordering class on view
			taskItemEl.closest(".zen-todo-view")?.addClass("is-reordering");
		}

		if (!state.isDragging || !state.cloneEl || !state.indicatorEl) return;

		// Position clone relative to container
		const containerRect = dropContainer.getBoundingClientRect();
		const cloneTop = e.clientY - containerRect.top - state.handleOffsetY;
		state.cloneEl.style.top = `${cloneTop}px`;

		// Compute drop index and position indicator
		state.dropIndex = getDropIndex(e.clientY, state.siblings);
		positionIndicator(state.indicatorEl, state.siblings, state.dropIndex, containerRect);

		// Auto-scroll near scroll container edges
		updateAutoScroll(dropContainer, e.clientY, state);
	});

	handleEl.addEventListener("pointerup", () => {
		if (!state) return;
		if (state.isDragging) {
			const orderedIds = computeOrderedIds(taskItemEl, state.siblings, state.dropIndex);
			cleanup(state, dropContainer);
			state = null;
			onDragStateChange?.(false);
			// Only call onReorder when there's actually more than one item in the group
			if (orderedIds.length > 1) {
				onReorder(orderedIds);
			}
		} else {
			cleanup(state, dropContainer);
			state = null;
		}
	});

	handleEl.addEventListener("pointercancel", () => {
		if (!state) return;
		cleanup(state, dropContainer);
		state = null;
		onDragStateChange?.(false);
	});
}

function getDropIndex(cursorY: number, siblings: HTMLElement[]): number {
	for (let i = 0; i < siblings.length; i++) {
		const rect = siblings[i].getBoundingClientRect();
		if (cursorY < rect.top + rect.height / 2) return i;
	}
	return siblings.length;
}

function positionIndicator(
	indicatorEl: HTMLElement,
	siblings: HTMLElement[],
	dropIndex: number,
	containerRect: DOMRect
): void {
	if (siblings.length === 0) {
		indicatorEl.style.top = "0px";
		return;
	}
	let top: number;
	if (dropIndex === 0) {
		top = siblings[0].getBoundingClientRect().top - containerRect.top;
	} else {
		const prev = siblings[Math.min(dropIndex, siblings.length) - 1];
		top = prev.getBoundingClientRect().bottom - containerRect.top;
	}
	indicatorEl.style.top = `${top}px`;
}

function computeOrderedIds(
	taskItemEl: HTMLElement,
	siblings: HTMLElement[],
	dropIndex: number
): string[] {
	const newOrder = [
		...siblings.slice(0, dropIndex),
		taskItemEl,
		...siblings.slice(dropIndex),
	];
	return newOrder.map((el) => el.getAttribute("data-task-id") ?? "").filter(Boolean);
}

function updateAutoScroll(
	dropContainer: HTMLElement,
	cursorY: number,
	state: DragState
): void {
	const scrollEl = dropContainer.closest(".zen-todo-content") as HTMLElement | null;
	if (!scrollEl) return;

	if (state.autoScrollTimer !== null) {
		clearInterval(state.autoScrollTimer);
		state.autoScrollTimer = null;
	}

	const rect = scrollEl.getBoundingClientRect();
	const threshold = 60;
	const speed = 8;

	if (cursorY < rect.top + threshold) {
		state.autoScrollTimer = window.setInterval(() => scrollEl.scrollBy(0, -speed), 16);
	} else if (cursorY > rect.bottom - threshold) {
		state.autoScrollTimer = window.setInterval(() => scrollEl.scrollBy(0, speed), 16);
	}
}

function cleanup(state: DragState, dropContainer: HTMLElement): void {
	if (state.autoScrollTimer !== null) {
		clearInterval(state.autoScrollTimer);
		state.autoScrollTimer = null;
	}
	if (state.keydownHandler) {
		document.removeEventListener("keydown", state.keydownHandler);
		state.keydownHandler = null;
	}
	state.taskItemEl.removeClass("is-dragging");
	state.cloneEl?.remove();
	state.indicatorEl?.remove();
	state.taskItemEl.closest(".zen-todo-view")?.removeClass("is-reordering");
}
