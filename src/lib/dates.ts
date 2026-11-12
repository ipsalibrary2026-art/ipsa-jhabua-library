export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export function addDaysISO(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export function parseISODate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`);
}

export function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseISODate(isoDate));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function daysBetween(fromISO: string, toISO: string) {
  const from = parseISODate(fromISO).getTime();
  const to = parseISODate(toISO).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function overdueDays(dueDate: string) {
  const difference = daysBetween(dueDate, todayISO());
  return difference > 0 ? difference : 0;
}

export function isOverdue(record: { status: string; dueDate: string }) {
  return record.status === "issued" && record.dueDate < todayISO();
}

export function monthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function monthLabel(key: string) {
  const date = new Date(`${key}-01T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
}

export function lastNMonths(count: number) {
  const months: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - index, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
