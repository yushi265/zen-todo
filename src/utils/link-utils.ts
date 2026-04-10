import { requestUrl } from "obsidian";

const STANDALONE_HTTP_URL_REGEX = /^https?:\/\/\S+$/i;
const URL_AT_START_REGEX = /^https?:\/\/[^\s<>]+/i;

export interface ParsedWikiLink {
  displayText: string;
  linkTarget: string;
  endIndex: number;
}

export interface ParsedMarkdownExternalLink {
  label: string;
  url: string;
  endIndex: number;
  raw: string;
}

export interface ParsedBareUrl {
  url: string;
  trailingText: string;
  endIndex: number;
}

export function parseStandaloneHttpUrl(text: string): string | null {
  const trimmed = text.trim();
  return STANDALONE_HTTP_URL_REGEX.test(trimmed) ? trimmed : null;
}

export function buildMarkdownExternalLink(label: string, url: string): string {
  const safeLabel = label.trim().replace(/[[\]\\]/g, "\\$&");
  const safeUrl = url.trim().replace(/>/g, "%3E");
  return `[${safeLabel}](<${safeUrl}>)`;
}

export function parseWikiLinkAt(
  text: string,
  startIndex: number,
): ParsedWikiLink | null {
  if (!text.startsWith("[[", startIndex)) return null;

  const endIndex = text.indexOf("]]", startIndex + 2);
  if (endIndex === -1) return null;

  const inner = text.slice(startIndex + 2, endIndex);
  const pipeIdx = inner.indexOf("|");
  return {
    displayText: pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : inner,
    linkTarget: pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner,
    endIndex: endIndex + 2,
  };
}

export function parseMarkdownExternalLinkAt(
  text: string,
  startIndex: number,
): ParsedMarkdownExternalLink | null {
  if (text[startIndex] !== "[" || text.startsWith("[[", startIndex)) {
    return null;
  }

  const labelEnd = findMarkdownLabelEnd(text, startIndex + 1);
  if (labelEnd === -1 || text[labelEnd + 1] !== "(") return null;

  const rawLabel = text.slice(startIndex + 1, labelEnd);
  if (!rawLabel) return null;
  const label = rawLabel.replace(/\\([[\]\\])/g, "$1");

  const urlStart = labelEnd + 2;
  if (urlStart >= text.length) return null;

  if (text[urlStart] === "<") {
    const urlEnd = text.indexOf(">)", urlStart + 1);
    if (urlEnd === -1) return null;
    const url = text.slice(urlStart + 1, urlEnd).trim();
    if (!parseStandaloneHttpUrl(url)) return null;
    return {
      label,
      url,
      endIndex: urlEnd + 2,
      raw: text.slice(startIndex, urlEnd + 2),
    };
  }

  let depth = 1;
  let cursor = urlStart;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        const url = text.slice(urlStart, cursor).trim();
        if (!parseStandaloneHttpUrl(url)) return null;
        return {
          label,
          url,
          endIndex: cursor + 1,
          raw: text.slice(startIndex, cursor + 1),
        };
      }
    }
    cursor += 1;
  }

  return null;
}

export function parseBareUrlAt(
  text: string,
  startIndex: number,
): ParsedBareUrl | null {
  const slice = text.slice(startIndex);
  const match = URL_AT_START_REGEX.exec(slice);
  if (!match) return null;

  let url = match[0];
  const trailingPunct = url.match(/[.,;:!?)}\]'"]+$/);
  let trailingText = "";
  if (trailingPunct) {
    trailingText = trailingPunct[0];
    url = url.slice(0, url.length - trailingText.length);
  }

  return {
    url,
    trailingText,
    endIndex: startIndex + match[0].length,
  };
}

export function attachSmartUrlPaste(input: HTMLInputElement): void {
  input.addEventListener("paste", (event: ClipboardEvent) => {
    const pasted = event.clipboardData?.getData("text/plain");
    const url = pasted ? parseStandaloneHttpUrl(pasted) : null;
    if (!url) return;

    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? input.value.length;
    const selectedText = input.value.slice(selectionStart, selectionEnd).trim();

    event.preventDefault();

    if (selectedText) {
      replaceInputRange(
        input,
        selectionStart,
        selectionEnd,
        buildMarkdownExternalLink(selectedText, url),
      );
      return;
    }

    replaceInputRange(input, selectionStart, selectionEnd, url);

    void fetchUrlTitle(url).then((title) => {
      if (!title) return;
      const currentText = input.value.slice(selectionStart, selectionStart + url.length);
      if (currentText !== url) return;
      replaceInputRange(
        input,
        selectionStart,
        selectionStart + url.length,
        buildMarkdownExternalLink(title, url),
        true,
      );
    });
  });
}

export async function fetchUrlTitle(url: string): Promise<string | null> {
  try {
    const response = await requestUrl({
      url,
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
      throw: false,
    });

    if (response.status >= 400) return null;

    const contentType =
      response.headers["content-type"] ?? response.headers["Content-Type"] ?? "";
    if (!contentType.toLowerCase().includes("html")) return null;

    const title = extractTitleFromHtml(response.text);
    return title ? sanitizeLinkLabel(title) : null;
  } catch {
    return null;
  }
}

function replaceInputRange(
  input: HTMLInputElement,
  start: number,
  end: number,
  replacement: string,
  preserveSelection = false,
): void {
  const currentSelectionStart = input.selectionStart ?? end;
  const currentSelectionEnd = input.selectionEnd ?? end;

  input.value =
    input.value.slice(0, start) + replacement + input.value.slice(end);
  input.dispatchEvent(new Event("input", { bubbles: true }));

  const nextEnd = start + replacement.length;
  if (!preserveSelection) {
    input.setSelectionRange(nextEnd, nextEnd);
    return;
  }

  const delta = replacement.length - (end - start);
  const nextSelectionStart = adjustSelectionIndex(
    currentSelectionStart,
    start,
    end,
    delta,
    nextEnd,
  );
  const nextSelectionEnd = adjustSelectionIndex(
    currentSelectionEnd,
    start,
    end,
    delta,
    nextEnd,
  );
  input.setSelectionRange(nextSelectionStart, nextSelectionEnd);
}

function adjustSelectionIndex(
  index: number,
  start: number,
  end: number,
  delta: number,
  replacementEnd: number,
): number {
  if (index <= start) return index;
  if (index >= end) return index + delta;
  return replacementEnd;
}

function extractTitleFromHtml(html: string): string | null {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const metaTitle = doc
      .querySelector('meta[property="og:title"], meta[name="twitter:title"]')
      ?.getAttribute("content");
    if (metaTitle?.trim()) return decodeHtmlEntities(metaTitle.trim());
    if (doc.title.trim()) return decodeHtmlEntities(doc.title.trim());
  }

  const metaMatch = html.match(
    /<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  );
  if (metaMatch?.[1]) return decodeHtmlEntities(metaMatch[1].trim());

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) return decodeHtmlEntities(titleMatch[1].trim());

  return null;
}

function decodeHtmlEntities(value: string): string {
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function sanitizeLinkLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function findMarkdownLabelEnd(text: string, startIndex: number): number {
  let depth = 1;
  let cursor = startIndex;

  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "\\") {
      cursor += 2;
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }
    cursor += 1;
  }

  return -1;
}
