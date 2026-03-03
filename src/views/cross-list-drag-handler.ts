import { setIcon } from "obsidian";

export interface ListGroupInfo {
	filePath: string;
	groupEl: HTMLElement;
}

export interface CrossListDragCallbacks {
	onReorder: (orderedIds: string[], sourceFilePath: string) => void;
	onMove: (
		taskId: string,
		sourceFilePath: string,
		targetFilePath: string,
		dropIndex: number,
	) => void;
	onDragStateChange?: (dragging: boolean) => void;
}

interface CrossListDragState {
	taskItemEl: HTMLElement;
	taskId: string;
	sourceFilePath: string;
	startY: number;
	handleOffsetY: number;
	isDragging: boolean;
	cloneEl: HTMLElement | null;
	indicatorEl: HTMLElement | null;
	currentTargetFilePath: string;
	currentTargetSection: HTMLElement | null;
	currentSiblings: HTMLElement[];
	dropIndex: number;
	autoScrollTimer: number | null;
	keydownHandler: ((e: KeyboardEvent) => void) | null;
}

export function attachCrossListDragHandle(
	taskItemEl: HTMLElement,
	taskRowEl: HTMLElement,
	sourceFilePath: string,
	scrollContainer: HTMLElement,
	listGroups: ListGroupInfo[],
	callbacks: CrossListDragCallbacks,
): void {
	const handleEl = createEl("div", { cls: "zen-todo-drag-handle" });
	setIcon(handleEl, "grip-vertical");
	taskRowEl.insertBefore(handleEl, taskRowEl.firstChild);

	let state: CrossListDragState | null = null;

	handleEl.addEventListener("pointerdown", (e: PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		handleEl.setPointerCapture(e.pointerId);
		const rect = taskItemEl.getBoundingClientRect();
		state = {
			taskItemEl,
			taskId: taskItemEl.getAttribute("data-task-id") ?? "",
			sourceFilePath,
			startY: e.clientY,
			handleOffsetY: e.clientY - rect.top,
			isDragging: false,
			cloneEl: null,
			indicatorEl: null,
			currentTargetFilePath: sourceFilePath,
			currentTargetSection: null,
			currentSiblings: [],
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
			callbacks.onDragStateChange?.(true);

			const keydownHandler = (ev: KeyboardEvent) => {
				if (ev.key === "Escape" && state) {
					cleanup(state, scrollContainer, listGroups);
					state = null;
					callbacks.onDragStateChange?.(false);
				}
			};
			state.keydownHandler = keydownHandler;
			document.addEventListener("keydown", keydownHandler);

			taskItemEl.addClass("is-dragging");
			scrollContainer.style.position = "relative";

			// Clone (first row only for visual)
			const cloneEl = scrollContainer.createDiv({ cls: "zen-todo-drag-clone" });
			const firstRow = taskItemEl.querySelector(".zen-todo-task-row");
			if (firstRow) {
				cloneEl.appendChild(firstRow.cloneNode(true));
			}
			cloneEl.style.height = taskItemEl.getBoundingClientRect().height + "px";
			state.cloneEl = cloneEl;

			// Drop indicator
			state.indicatorEl = scrollContainer.createDiv({ cls: "zen-todo-drop-indicator" });

			// Highlight source group
			const sourceGroup = listGroups.find((g) => g.filePath === sourceFilePath);
			sourceGroup?.groupEl.addClass("is-drag-over");

			// Reordering class on view
			taskItemEl.closest(".zen-todo-view")?.addClass("is-reordering");
		}

		if (!state.isDragging || !state.cloneEl || !state.indicatorEl) return;

		const containerRect = scrollContainer.getBoundingClientRect();
		const scrollTop = scrollContainer.scrollTop;

		// Position clone relative to scrollContainer (accounts for scroll)
		const cloneTop = e.clientY - containerRect.top + scrollTop - state.handleOffsetY;
		state.cloneEl.style.top = `${cloneTop}px`;

		// Find target group under cursor
		const targetGroup = findTargetGroup(e.clientY, listGroups);
		if (targetGroup) {
			// Update is-drag-over when group changes
			if (targetGroup.filePath !== state.currentTargetFilePath) {
				const oldGroup = listGroups.find((g) => g.filePath === state!.currentTargetFilePath);
				oldGroup?.groupEl.removeClass("is-drag-over");
				targetGroup.groupEl.addClass("is-drag-over");
				state.currentTargetFilePath = targetGroup.filePath;
			}

			const isCompleted = taskItemEl.classList.contains("is-completed");
			const isSameGroup = targetGroup.filePath === sourceFilePath;
			const section = getTargetSection(targetGroup.groupEl, isCompleted);
			state.currentTargetSection = section;
			state.currentSiblings = getSiblingsInSection(
				section,
				isSameGroup ? state.taskId : undefined,
			);
			state.dropIndex = getDropIndex(e.clientY, state.currentSiblings);

			positionIndicator(
				state.indicatorEl,
				state.currentSiblings,
				state.dropIndex,
				containerRect,
				scrollTop,
				section,
			);
		}

		updateAutoScroll(scrollContainer, e.clientY, state);
	});

	handleEl.addEventListener("pointerup", () => {
		if (!state) return;
		if (state.isDragging) {
			const { taskId, sourceFilePath: src, currentTargetFilePath, dropIndex, currentSiblings } =
				state;
			const isSameGroup = currentTargetFilePath === src;

			if (isSameGroup) {
				// Same group: reorder
				const orderedIds = computeOrderedIds(taskItemEl, currentSiblings, dropIndex);
				cleanup(state, scrollContainer, listGroups);
				state = null;
				callbacks.onDragStateChange?.(false);
				if (orderedIds.length > 1) {
					callbacks.onReorder(orderedIds, src);
				}
			} else {
				// Different group: move
				cleanup(state, scrollContainer, listGroups);
				state = null;
				callbacks.onDragStateChange?.(false);
				callbacks.onMove(taskId, src, currentTargetFilePath, dropIndex);
			}
		} else {
			cleanup(state, scrollContainer, listGroups);
			state = null;
		}
	});

	handleEl.addEventListener("pointercancel", () => {
		if (!state) return;
		cleanup(state, scrollContainer, listGroups);
		state = null;
		callbacks.onDragStateChange?.(false);
	});
}

function findTargetGroup(cursorY: number, listGroups: ListGroupInfo[]): ListGroupInfo | null {
	// Find group directly under cursor
	for (const group of listGroups) {
		const rect = group.groupEl.getBoundingClientRect();
		if (cursorY >= rect.top && cursorY <= rect.bottom) {
			return group;
		}
	}
	// Fallback: find nearest group
	let nearest: ListGroupInfo | null = null;
	let minDist = Infinity;
	for (const group of listGroups) {
		const rect = group.groupEl.getBoundingClientRect();
		const dist = Math.min(Math.abs(cursorY - rect.top), Math.abs(cursorY - rect.bottom));
		if (dist < minDist) {
			minDist = dist;
			nearest = group;
		}
	}
	return nearest;
}

function getTargetSection(groupEl: HTMLElement, isCompleted: boolean): HTMLElement | null {
	if (isCompleted) {
		return groupEl.querySelector(".zen-todo-completed-section") as HTMLElement | null;
	}
	return groupEl.querySelector(".zen-todo-incomplete-section") as HTMLElement | null;
}

function getSiblingsInSection(
	section: HTMLElement | null,
	excludeTaskId?: string,
): HTMLElement[] {
	if (!section) return [];
	return Array.from(section.querySelectorAll(":scope > .zen-todo-task-item")).filter(
		(el) => !excludeTaskId || el.getAttribute("data-task-id") !== excludeTaskId,
	) as HTMLElement[];
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
	containerRect: DOMRect,
	scrollTop: number,
	section: HTMLElement | null,
): void {
	let top: number;
	if (siblings.length === 0) {
		const sectionRect = section?.getBoundingClientRect();
		top = sectionRect ? sectionRect.top - containerRect.top + scrollTop : 0;
	} else if (dropIndex === 0) {
		const rect = siblings[0].getBoundingClientRect();
		top = rect.top - containerRect.top + scrollTop;
	} else {
		const prev = siblings[Math.min(dropIndex, siblings.length) - 1];
		top = prev.getBoundingClientRect().bottom - containerRect.top + scrollTop;
	}
	indicatorEl.style.top = `${top}px`;
}

function computeOrderedIds(
	taskItemEl: HTMLElement,
	siblings: HTMLElement[],
	dropIndex: number,
): string[] {
	const newOrder = [
		...siblings.slice(0, dropIndex),
		taskItemEl,
		...siblings.slice(dropIndex),
	];
	return newOrder.map((el) => el.getAttribute("data-task-id") ?? "").filter(Boolean);
}

function updateAutoScroll(
	scrollContainer: HTMLElement,
	cursorY: number,
	state: CrossListDragState,
): void {
	if (state.autoScrollTimer !== null) {
		clearInterval(state.autoScrollTimer);
		state.autoScrollTimer = null;
	}

	const rect = scrollContainer.getBoundingClientRect();
	const threshold = 60;
	const speed = 8;

	if (cursorY < rect.top + threshold) {
		state.autoScrollTimer = window.setInterval(() => scrollContainer.scrollBy(0, -speed), 16);
	} else if (cursorY > rect.bottom - threshold) {
		state.autoScrollTimer = window.setInterval(() => scrollContainer.scrollBy(0, speed), 16);
	}
}

function cleanup(
	state: CrossListDragState,
	scrollContainer: HTMLElement,
	listGroups: ListGroupInfo[],
): void {
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
	scrollContainer.style.position = "";
	for (const group of listGroups) {
		group.groupEl.removeClass("is-drag-over");
	}
	state.taskItemEl.closest(".zen-todo-view")?.removeClass("is-reordering");
}
