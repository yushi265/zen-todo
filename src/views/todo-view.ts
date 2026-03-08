import { ItemView, Platform, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_ZEN_TODO, ALL_LISTS_PATH } from "../constants";
import { ZenTodoController } from "./todo-controller";
import type ZenTodoPlugin from "../main";

interface VirtualKeyboardLike extends EventTarget {
	boundingRect?: DOMRectReadOnly;
}

interface NavigatorWithVirtualKeyboard extends Navigator {
	virtualKeyboard?: VirtualKeyboardLike;
}

export class ZenTodoView extends ItemView {
	private plugin: ZenTodoPlugin;
	private controller: ZenTodoController | null = null;
	private detachViewportSync: (() => void) | null = null;
	private rootEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ZenTodoPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ZEN_TODO;
	}

	getDisplayText(): string {
		return "ZenTodo";
	}

	getIcon(): string {
		return "check-square";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.removeClass("zen-todo-view");
		this.contentEl.addClass("zen-todo-view-host");
		this.rootEl = this.contentEl.createDiv({ cls: "zen-todo-view" });
		this.detachViewportSync = this.attachMobileViewportSync(this.contentEl, this.rootEl);
		this.controller = new ZenTodoController(
			{
				app: this.app,
				settings: this.plugin.settings,
				saveSettings: () => this.plugin.saveSettings(),
			},
			this.rootEl,
			() => this.createNewList()
		);
		await this.controller.initialize();
	}

	async onClose(): Promise<void> {
		this.detachViewportSync?.();
		this.detachViewportSync = null;
		this.controller?.destroy();
		this.controller = null;
		this.rootEl = null;
		this.contentEl.removeClass("zen-todo-view-host", "is-keyboard-overlay");
		this.contentEl.empty();
	}

	getState(): Record<string, unknown> {
		return { activeFilePath: this.controller?.activeFilePath ?? null };
	}

	async setState(state: Record<string, unknown>): Promise<void> {
		if (this.controller && typeof state.activeFilePath === "string") {
			this.controller.activeFilePath = state.activeFilePath;
		}
		await this.controller?.initialize();
	}

	/** Called by main.ts when a todo file changes externally. */
	onExternalChange(filePath: string): void {
		this.controller?.onExternalChange(filePath);
	}

	/** Public: opens the new-list modal (triggered by command). */
	async createNewList(): Promise<void> {
		await this.controller?.createNewList();
	}

	/** Switch to the All view tab. */
	showAllView(): void {
		if (this.controller) {
			this.controller.activeFilePath = ALL_LISTS_PATH;
			this.controller.render();
		}
	}

	/** Re-render the view immediately (e.g. after a language change). */
	forceRender(): void {
		this.controller?.render();
	}

	private attachMobileViewportSync(hostEl: HTMLElement, rootEl: HTMLElement): (() => void) | null {
		if (!Platform.isMobile) return null;

		const visualViewport = window.visualViewport;
		const virtualKeyboard = (navigator as NavigatorWithVirtualKeyboard).virtualKeyboard;
		const debugEnabled = window.localStorage.getItem("zen-todo-viewport-debug") === "1";
		let baselineViewportBottom = 0;
		let delayedSyncTimer: ReturnType<typeof setTimeout> | null = null;

		const isFocusableKeyboardTarget = (target: EventTarget | null): target is HTMLElement => {
			return target instanceof HTMLElement
				&& target.matches("input, textarea, select, [contenteditable='true']");
		};

		const getViewportBottom = () => {
			if (visualViewport) {
				return visualViewport.offsetTop + visualViewport.height;
			}
			return window.innerHeight;
		};

		const getVirtualKeyboardInset = () => {
			const height = virtualKeyboard?.boundingRect?.height;
			return typeof height === "number" && height > 0 ? height : 0;
		};

		const debugViewport = (reason: string, keyboardInset: number, viewportBottom: number) => {
			if (!debugEnabled) return;
			const contentEl = rootEl.querySelector(".zen-todo-content") as HTMLElement | null;
			const activeEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			console.debug("[ZenTodo viewport]", {
				reason,
				windowInnerHeight: window.innerHeight,
				documentClientHeight: document.documentElement.clientHeight,
				visualViewportHeight: visualViewport?.height ?? null,
				visualViewportOffsetTop: visualViewport?.offsetTop ?? null,
				virtualKeyboardHeight: getVirtualKeyboardInset(),
				viewportBottom,
				baselineViewportBottom,
				keyboardInset,
				hostClientHeight: hostEl.clientHeight,
				rootClientHeight: rootEl.clientHeight,
				contentClientHeight: contentEl?.clientHeight ?? null,
				activeElementRect: activeEl?.getBoundingClientRect?.() ?? null,
			});
		};

		const syncViewportHeight = (reason: string) => {
			const hostTop = hostEl.getBoundingClientRect().top;
			const viewportBottom = getViewportBottom();
			const currentFocus = isFocusableKeyboardTarget(document.activeElement) ? document.activeElement : null;
			const viewportDelta = Math.max(0, baselineViewportBottom - viewportBottom);
			const keyboardInsetFromApi = getVirtualKeyboardInset();
			const keyboardInset = keyboardInsetFromApi > 0 ? keyboardInsetFromApi : viewportDelta;
			const availableHeight = Math.max(0, Math.round(viewportBottom - hostTop));
			// 24px hysteresis: avoid toggling overlay class when API and heuristic values are nearly equal
			const overlayActive = currentFocus !== null
				&& keyboardInset > 0
				&& keyboardInsetFromApi > viewportDelta + 24;

			if (!currentFocus || keyboardInset === 0 || viewportBottom >= baselineViewportBottom) {
				baselineViewportBottom = viewportBottom;
			}

			if (availableHeight > 0) {
				rootEl.style.setProperty(
					"--zen-todo-mobile-viewport-height",
					`${availableHeight}px`,
				);
			} else {
				rootEl.style.removeProperty("--zen-todo-mobile-viewport-height");
			}

			if (keyboardInset > 0) {
				rootEl.style.setProperty("--zen-todo-keyboard-inset", `${Math.round(keyboardInset)}px`);
			} else {
				rootEl.style.removeProperty("--zen-todo-keyboard-inset");
			}

			if (overlayActive) {
				hostEl.addClass("is-keyboard-overlay");
			} else {
				hostEl.removeClass("is-keyboard-overlay");
			}
			debugViewport(reason, keyboardInset, viewportBottom);
		};

		const queueDelayedSync = (reason: string) => {
			syncViewportHeight(reason);
			window.requestAnimationFrame(() => syncViewportHeight(`${reason}:raf`));
			if (delayedSyncTimer) clearTimeout(delayedSyncTimer);
			delayedSyncTimer = setTimeout(() => {
				syncViewportHeight(`${reason}:timeout`);
				delayedSyncTimer = null;
			}, 150);
		};

		const handleWindowResize = () => syncViewportHeight("window-resize");
		const handleVisualViewportChange = () => syncViewportHeight("visual-viewport");
		const handleFocusIn = () => queueDelayedSync("focusin");
		const handleFocusOut = () => queueDelayedSync("focusout");
		const handleVirtualKeyboardChange = () => syncViewportHeight("virtual-keyboard");

		baselineViewportBottom = getViewportBottom();
		syncViewportHeight("init");
		window.addEventListener("resize", handleWindowResize);
		document.addEventListener("focusin", handleFocusIn);
		document.addEventListener("focusout", handleFocusOut);

		if (visualViewport) {
			visualViewport.addEventListener("resize", handleVisualViewportChange);
			visualViewport.addEventListener("scroll", handleVisualViewportChange);
		}
		virtualKeyboard?.addEventListener("geometrychange", handleVirtualKeyboardChange);

		return () => {
			if (delayedSyncTimer) clearTimeout(delayedSyncTimer);
			window.removeEventListener("resize", handleWindowResize);
			document.removeEventListener("focusin", handleFocusIn);
			document.removeEventListener("focusout", handleFocusOut);
			if (visualViewport) {
				visualViewport.removeEventListener("resize", handleVisualViewportChange);
				visualViewport.removeEventListener("scroll", handleVisualViewportChange);
			}
			virtualKeyboard?.removeEventListener("geometrychange", handleVirtualKeyboardChange);
			rootEl.style.removeProperty("--zen-todo-mobile-viewport-height");
			rootEl.style.removeProperty("--zen-todo-keyboard-inset");
			hostEl.removeClass("is-keyboard-overlay");
		};
	}
}
