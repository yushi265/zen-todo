interface TabDragState {
	tabEl: HTMLElement;
	startX: number;
	offsetX: number;
	isDragging: boolean;
	cloneEl: HTMLElement | null;
	indicatorEl: HTMLElement | null;
	siblings: HTMLElement[];
	dropIndex: number;
	keydownHandler: ((e: KeyboardEvent) => void) | null;
}

export function attachTabDrag(
	tabEl: HTMLElement,
	tabsContainer: HTMLElement,
	onReorder: (orderedFilePaths: string[]) => void
): void {
	let state: TabDragState | null = null;

	tabEl.addEventListener("pointerdown", (e: PointerEvent) => {
		if (e.button !== 0) return;
		e.preventDefault();
		tabEl.setPointerCapture(e.pointerId);
		const rect = tabEl.getBoundingClientRect();
		state = {
			tabEl,
			startX: e.clientX,
			offsetX: e.clientX - rect.left,
			isDragging: false,
			cloneEl: null,
			indicatorEl: null,
			siblings: [],
			dropIndex: 0,
			keydownHandler: null,
		};
	});

	tabEl.addEventListener("pointermove", (e: PointerEvent) => {
		if (!state) return;
		const dx = Math.abs(e.clientX - state.startX);

		if (!state.isDragging) {
			if (dx < 5) return;
			// --- begin drag ---
			state.isDragging = true;

			const keydownHandler = (ev: KeyboardEvent) => {
				if (ev.key === "Escape" && state) {
					cleanup(state, tabsContainer);
					state = null;
				}
			};
			state.keydownHandler = keydownHandler;
			document.addEventListener("keydown", keydownHandler);

			// Collect siblings (all tabs except the dragged one)
			state.siblings = Array.from(
				tabsContainer.querySelectorAll(":scope > .zen-todo-tab")
			).filter((el) => el !== tabEl) as HTMLElement[];

			tabEl.addClass("is-dragging");
			tabsContainer.style.position = "relative";

			// Clone: visually mirrors the dragged tab
			const cloneEl = tabsContainer.createEl("div", {
				cls: "zen-todo-tab-drag-clone",
				text: tabEl.textContent ?? "",
			});
			const tabRect = tabEl.getBoundingClientRect();
			cloneEl.style.height = tabRect.height + "px";
			state.cloneEl = cloneEl;

			// Drop indicator (vertical line)
			state.indicatorEl = tabsContainer.createEl("div", {
				cls: "zen-todo-tab-drop-indicator",
			});

			tabEl.closest(".zen-todo-view")?.addClass("is-reordering");
		}

		if (!state.isDragging || !state.cloneEl || !state.indicatorEl) return;

		// Position clone relative to container
		const containerRect = tabsContainer.getBoundingClientRect();
		const cloneLeft = e.clientX - containerRect.left - state.offsetX;
		state.cloneEl.style.left = `${cloneLeft}px`;

		// Compute drop index and reposition indicator
		state.dropIndex = getTabDropIndex(e.clientX, state.siblings);
		positionTabIndicator(
			state.indicatorEl,
			state.siblings,
			state.dropIndex,
			containerRect
		);
	});

	tabEl.addEventListener("pointerup", () => {
		if (!state) return;
		if (state.isDragging) {
			const orderedPaths = computeOrderedPaths(tabEl, state.siblings, state.dropIndex);
			cleanup(state, tabsContainer);
			state = null;
			// Suppress the click that fires immediately after pointerup
			const suppressClick = (e: MouseEvent) => {
				e.stopPropagation();
				document.removeEventListener("click", suppressClick, true);
			};
			document.addEventListener("click", suppressClick, true);
			if (orderedPaths.length > 1) {
				onReorder(orderedPaths);
			}
		} else {
			cleanup(state, tabsContainer);
			state = null;
		}
	});

	tabEl.addEventListener("pointercancel", () => {
		if (!state) return;
		cleanup(state, tabsContainer);
		state = null;
	});
}

function getTabDropIndex(cursorX: number, siblings: HTMLElement[]): number {
	for (let i = 0; i < siblings.length; i++) {
		const rect = siblings[i].getBoundingClientRect();
		if (cursorX < rect.left + rect.width / 2) return i;
	}
	return siblings.length;
}

function positionTabIndicator(
	indicatorEl: HTMLElement,
	siblings: HTMLElement[],
	dropIndex: number,
	containerRect: DOMRect
): void {
	let left: number;
	if (siblings.length === 0) {
		left = 0;
	} else if (dropIndex === 0) {
		left = siblings[0].getBoundingClientRect().left - containerRect.left;
	} else if (dropIndex >= siblings.length) {
		left =
			siblings[siblings.length - 1].getBoundingClientRect().right -
			containerRect.left;
	} else {
		const prev = siblings[dropIndex - 1].getBoundingClientRect();
		const next = siblings[dropIndex].getBoundingClientRect();
		left = (prev.right + next.left) / 2 - containerRect.left;
	}
	indicatorEl.style.left = `${left}px`;
}

function computeOrderedPaths(
	tabEl: HTMLElement,
	siblings: HTMLElement[],
	dropIndex: number
): string[] {
	const newOrder = [
		...siblings.slice(0, dropIndex),
		tabEl,
		...siblings.slice(dropIndex),
	];
	return newOrder
		.map((el) => el.getAttribute("data-file-path") ?? "")
		.filter(Boolean);
}

function cleanup(state: TabDragState, tabsContainer: HTMLElement): void {
	if (state.keydownHandler) {
		document.removeEventListener("keydown", state.keydownHandler);
		state.keydownHandler = null;
	}
	state.tabEl.removeClass("is-dragging");
	state.cloneEl?.remove();
	state.indicatorEl?.remove();
	tabsContainer.style.position = "";
	state.tabEl.closest(".zen-todo-view")?.removeClass("is-reordering");
}
