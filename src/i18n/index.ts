import type { TranslationKeys } from "./types";
import { en } from "./en";
import { ja } from "./ja";

const locales: Record<string, TranslationKeys> = { en, ja };
let current: TranslationKeys = en;

export function initLocale(lang: string): void {
  const base = lang.split("-")[0].toLowerCase();
  current = locales[base] ?? en;
}

export function t(
  key: keyof TranslationKeys,
  vars?: Record<string, string | number>,
): string {
  let text = (current[key] ?? en[key] ?? key) as string;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
  }
  return text;
}
