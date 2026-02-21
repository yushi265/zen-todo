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
