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

export function formatRelativeDate(dateStr: string): string {
  const diff = Math.floor(
    (new Date(today()).getTime() - new Date(dateStr).getTime()) / 86400000,
  );
  if (diff <= 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 7) return `${diff}日前`;
  if (diff < 14) return "1週間前";
  if (diff < 21) return "2週間前";
  if (diff < 28) return "3週間前";
  if (diff < 365) return `${Math.floor(diff / 30)}ヶ月前`;
  return `${Math.floor(diff / 365)}年前`;
}
