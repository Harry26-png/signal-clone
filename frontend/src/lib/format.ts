const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const monthDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const dividerDate = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY);
}

/** Conversation list timestamp: "Now", "5m", "10:42 AM", "Mon", "Sep 12", "Sep 12, 2024". */
export function formatListTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "Now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  const days = daysAgo(date, now);
  if (days === 0) return timeFmt.format(date);
  if (days < 7) return weekdayShort.format(date);
  if (date.getFullYear() === now.getFullYear()) return monthDay.format(date);
  return fullDate.format(date);
}

/** Timestamp inside a message bubble: "Now", "5m", then the clock time. */
export function formatMessageTime(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return "Now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  return timeFmt.format(new Date(iso));
}

export function formatDayDivider(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = daysAgo(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return weekdayLong.format(date);
  if (date.getFullYear() === now.getFullYear()) return dividerDate.format(date);
  return fullDate.format(date);
}

export function isSameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

export function formatLastSeen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "Last seen just now";
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `Last seen ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const days = daysAgo(date, now);
  if (days === 0) return `Last seen today at ${timeFmt.format(date)}`;
  if (days === 1) return `Last seen yesterday at ${timeFmt.format(date)}`;
  return `Last seen ${monthDay.format(date)}`;
}

/** "+15550100001" -> "+1 555-010-0001"; other countries are shown as entered. */
export function formatPhone(phone: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+1 ${match[1]}-${match[2]}-${match[3]}` : phone;
}

export const DISAPPEARING_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: "Off" },
  { seconds: 30, label: "30 seconds" },
  { seconds: 5 * 60, label: "5 minutes" },
  { seconds: 60 * 60, label: "1 hour" },
  { seconds: 8 * 60 * 60, label: "8 hours" },
  { seconds: 24 * 60 * 60, label: "1 day" },
  { seconds: 7 * 24 * 60 * 60, label: "1 week" },
  { seconds: 28 * 24 * 60 * 60, label: "4 weeks" },
];

export function formatDuration(seconds: number): string {
  const preset = DISAPPEARING_OPTIONS.find((o) => o.seconds === seconds);
  if (preset) return preset.label;
  const units: [number, string][] = [
    [7 * 86400, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  const [size, unit] = units.find(([size]) => seconds % size === 0 && seconds >= size) ?? [1, "second"];
  const count = seconds / size;
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
