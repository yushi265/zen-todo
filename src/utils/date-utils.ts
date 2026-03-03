import { t } from "../i18n";

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function today(): string {
  return formatDate(new Date());
}

export function isOverdue(dateStr: string): boolean {
  return dateStr < today();
}

export function isToday(dateStr: string): boolean {
  return dateStr === today();
}

export function isThisWeek(dateStr: string): boolean {
  const t = today();
  const d = new Date(t);
  // Monday-based week start
  const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0, Sun=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mondayStr = formatDate(monday);
  const sundayStr = formatDate(sunday);
  return dateStr >= mondayStr && dateStr <= sundayStr;
}

export function isThisMonth(dateStr: string): boolean {
  return dateStr.startsWith(today().slice(0, 7));
}

export function formatRelativeDate(dateStr: string): string {
  const diff = Math.floor(
    (new Date(today()).getTime() - new Date(dateStr).getTime()) / 86400000,
  );
  if (diff <= 0) return t("date.today");
  if (diff === 1) return t("date.yesterday");
  if (diff < 7) return t("date.daysAgo", { count: diff });
  if (diff < 14) return t("date.oneWeekAgo");
  if (diff < 21) return t("date.twoWeeksAgo");
  if (diff < 28) return t("date.threeWeeksAgo");
  if (diff < 365) return t("date.monthsAgo", { count: Math.floor(diff / 30) });
  return t("date.yearsAgo", { count: Math.floor(diff / 365) });
}
