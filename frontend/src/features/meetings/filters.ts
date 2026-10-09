import type { Channel, DurationBucket, MeetingFilters, MeetingSource, QuickFilter } from "@/lib/types";

export type DatePreset = "any" | "today" | "7d" | "14d" | "30d" | "custom";

/** Everything the library page lets the user filter by; serialized to / from the URL. */
export interface LibraryState {
  q: string;
  channel: Channel;
  quick: QuickFilter | null;
  hosts: number[];
  participants: number[];
  sources: MeetingSource[];
  durations: DurationBucket[];
  topics: number[];
  date: DatePreset;
  from: string; // yyyy-mm-dd (custom range)
  to: string;
  sort: "recent" | "oldest";
}

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any Time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Date Range" },
];

export const DURATIONS: { value: DurationBucket; label: string }[] = [
  { value: "lt15", label: "Less than 15 mins" },
  { value: "15to30", label: "15 - 30 mins" },
  { value: "30to60", label: "30 - 60 mins" },
  { value: "60to90", label: "60 - 90 mins" },
  { value: "gt90", label: "90+ mins" },
];

export const SOURCES: { value: MeetingSource; label: string }[] = [
  { value: "notetaker", label: "Meeting Notetaker" },
  { value: "chrome_extension", label: "Chrome Extension" },
  { value: "desktop", label: "Desktop App" },
  { value: "mobile", label: "Mobile App" },
  { value: "upload", label: "Uploads" },
];

const CHANNELS: Channel[] = ["all", "mine", "uploads"];

function numbers(params: URLSearchParams, key: string): number[] {
  return params
    .getAll(key)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

export function parseLibraryState(params: URLSearchParams): LibraryState {
  const date = oneOf(
    DATE_PRESETS.map((p) => p.value),
    params.get("date"),
    "any",
  );
  const quick = params.get("quick");
  return {
    q: params.get("q") ?? "",
    channel: oneOf(CHANNELS, params.get("channel"), "mine"),
    quick: quick === "hosted" || quick === "shared" ? quick : null,
    hosts: numbers(params, "host"),
    participants: numbers(params, "participant"),
    sources: params
      .getAll("source")
      .filter((s): s is MeetingSource => SOURCES.some((o) => o.value === s)),
    durations: params
      .getAll("duration")
      .filter((d): d is DurationBucket => DURATIONS.some((o) => o.value === d)),
    topics: numbers(params, "topic"),
    date,
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: params.get("sort") === "oldest" ? "oldest" : "recent",
  };
}

export function serializeLibraryState(state: LibraryState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.channel !== "mine") params.set("channel", state.channel);
  if (state.quick) params.set("quick", state.quick);
  state.hosts.forEach((id) => params.append("host", String(id)));
  state.participants.forEach((id) => params.append("participant", String(id)));
  state.sources.forEach((s) => params.append("source", s));
  state.durations.forEach((d) => params.append("duration", d));
  state.topics.forEach((id) => params.append("topic", String(id)));
  if (state.date !== "any") params.set("date", state.date);
  if (state.date === "custom") {
    if (state.from) params.set("from", state.from);
    if (state.to) params.set("to", state.to);
  }
  if (state.sort !== "recent") params.set("sort", state.sort);
  return params.toString();
}

/** Converts a date preset into an absolute range in the viewer's local time zone. */
function dateRange(state: LibraryState, now: Date): { from?: string; to?: string } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (days: number) => new Date(startOfToday.getTime() - days * 86_400_000);
  switch (state.date) {
    case "today":
      return { from: startOfToday.toISOString() };
    case "7d":
      return { from: daysAgo(6).toISOString() };
    case "14d":
      return { from: daysAgo(13).toISOString() };
    case "30d":
      return { from: daysAgo(29).toISOString() };
    case "custom": {
      const from = state.from ? new Date(`${state.from}T00:00:00`) : undefined;
      const to = state.to ? new Date(`${state.to}T23:59:59.999`) : undefined;
      return { from: from?.toISOString(), to: to?.toISOString() };
    }
    default:
      return {};
  }
}

export function toApiFilters(state: LibraryState, now: Date = new Date()): MeetingFilters {
  const { from, to } = dateRange(state, now);
  return {
    q: state.q.trim() || undefined,
    channel: state.channel,
    quick: state.quick ?? undefined,
    host: state.hosts,
    participant: state.participants,
    source: state.sources,
    duration: state.durations,
    topic: state.topics,
    date_from: from,
    date_to: to,
    sort: state.sort,
  };
}

export function activeFilterCount(state: LibraryState): number {
  return [
    state.hosts.length > 0,
    state.participants.length > 0,
    state.sources.length > 0,
    state.durations.length > 0,
    state.topics.length > 0,
    state.date !== "any",
  ].filter(Boolean).length;
}

export function clearedFilters(state: LibraryState): LibraryState {
  return {
    ...state,
    hosts: [],
    participants: [],
    sources: [],
    durations: [],
    topics: [],
    date: "any",
    from: "",
    to: "",
  };
}
