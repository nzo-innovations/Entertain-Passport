import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";

export function formatEventDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Date TBA";
  if (isToday(d)) return `Today \u00b7 ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow \u00b7 ${format(d, "h:mm a")}`;
  return format(d, "EEE, MMM d \u00b7 h:mm a");
}

export function formatEventDateLong(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return format(d, "EEEE, MMMM d, yyyy");
}

export function formatRelative(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}
