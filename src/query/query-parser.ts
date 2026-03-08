import { t } from "../i18n";

export type DateFilter =
  | { type: "relative"; period: "today" | "this_week" | "this_month" }
  | { type: "exact"; date: string }
  | { type: "before"; date: string }
  | { type: "after"; date: string };

export type FilterType =
  | { kind: "completed"; dateFilter: DateFilter }
  | { kind: "due"; dateFilter: DateFilter }
  | { kind: "overdue" }
  | { kind: "incomplete" }
  | { kind: "list"; name: string }
  | { kind: "tag"; name: string };

export interface Query {
  filters: FilterType[];
}

export interface ParseResult {
  query: Query | null; // null = empty source → full panel
  errors: string[];
}

function parseDateFilter(rest: string): DateFilter | null {
  const r = rest.trim().toLowerCase();
  if (r === "today") return { type: "relative", period: "today" };
  if (r === "this week") return { type: "relative", period: "this_week" };
  if (r === "this month") return { type: "relative", period: "this_month" };

  const exactMatch = rest.trim().match(/^(\d{4}-\d{2}-\d{2})$/);
  if (exactMatch) return { type: "exact", date: exactMatch[1] };

  const beforeMatch = rest.trim().match(/^before\s+(\d{4}-\d{2}-\d{2})$/i);
  if (beforeMatch) return { type: "before", date: beforeMatch[1] };

  const afterMatch = rest.trim().match(/^after\s+(\d{4}-\d{2}-\d{2})$/i);
  if (afterMatch) return { type: "after", date: afterMatch[1] };

  return null;
}

function parseLine(line: string): FilterType | null | "error" {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null; // empty or comment

  // completed ...
  const completedMatch = trimmed.match(/^completed\s+(.+)$/i);
  if (completedMatch) {
    const dateFilter = parseDateFilter(completedMatch[1]);
    if (!dateFilter) return "error";
    return { kind: "completed", dateFilter };
  }

  // due ...
  const dueMatch = trimmed.match(/^due\s+(.+)$/i);
  if (dueMatch) {
    const dateFilter = parseDateFilter(dueMatch[1]);
    if (!dateFilter) return "error";
    return { kind: "due", dateFilter };
  }

  // overdue
  if (/^overdue$/i.test(trimmed)) return { kind: "overdue" };

  // incomplete / not completed
  if (/^(incomplete|not\s+completed)$/i.test(trimmed)) return { kind: "incomplete" };

  // list: "name" or list: name
  const listMatch = trimmed.match(/^list:\s*"?(.+?)"?\s*$/i);
  if (listMatch) return { kind: "list", name: listMatch[1].trim() };

  // tag: work / tag: #work
  const tagMatch = trimmed.match(/^tag:\s*(.+)\s*$/i);
  if (tagMatch) {
    const name = tagMatch[1].trim().replace(/^#/, "");
    if (!name) return "error";
    return { kind: "tag", name };
  }

  return "error";
}

export function parseQuery(source: string): ParseResult {
  const trimmed = source.trim();
  if (!trimmed) return { query: null, errors: [] };

  const lines = trimmed.split("\n");
  const filters: FilterType[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const result = parseLine(line);
    if (result === null) continue;
    if (result === "error") {
      errors.push(t("query.unknownFilter", { filter: line.trim() }));
    } else {
      filters.push(result);
    }
  }

  return { query: { filters }, errors };
}

function describeDateFilter(df: DateFilter): string {
  switch (df.type) {
    case "relative":
      if (df.period === "today") return t("query.dateToday");
      if (df.period === "this_week") return t("query.dateThisWeek");
      return t("query.dateThisMonth");
    case "exact":
      return t("query.dateOn", { date: df.date });
    case "before":
      return t("query.dateBefore", { date: df.date });
    case "after":
      return t("query.dateAfter", { date: df.date });
  }
}

export function describeQuery(query: Query): string {
  if (query.filters.length === 0) return t("query.allTasks");
  return query.filters
    .map((f) => {
      switch (f.kind) {
        case "completed":
          return t("query.filterCompleted", { when: describeDateFilter(f.dateFilter) });
        case "due":
          return t("query.filterDue", { when: describeDateFilter(f.dateFilter) });
        case "overdue":
          return t("query.filterOverdue");
        case "incomplete":
          return t("query.filterIncomplete");
        case "list":
          return t("query.filterList", { name: f.name });
        case "tag":
          return t("query.filterTag", { name: f.name });
      }
    })
    .join(" · ");
}
