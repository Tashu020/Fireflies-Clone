"use client";

import { X } from "lucide-react";

import {
  DATE_PRESETS,
  DURATIONS,
  SOURCES,
  activeFilterCount,
  clearedFilters,
  type LibraryState,
} from "@/features/meetings/filters";
import { usePeople, useTopics, useUsers } from "@/features/workspace/api";

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex h-7 items-center gap-1 rounded-full border border-brand-soft-border bg-brand-soft pl-3 pr-1 text-13 text-brand-text">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-brand-soft-hover"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function names(ids: number[], lookup: Map<number, string>, noun: string): string {
  const first = lookup.get(ids[0] ?? -1) ?? noun;
  return ids.length > 1 ? `${first} +${ids.length - 1}` : first;
}

/** Removable chips for every applied filter. */
export function FilterChips({
  state,
  onChange,
}: {
  state: LibraryState;
  onChange: (state: LibraryState) => void;
}) {
  const { data: users = [] } = useUsers();
  const { data: people = [] } = usePeople("");
  const { data: topics = [] } = useTopics();
  if (activeFilterCount(state) === 0) return null;

  const userNames = new Map(users.map((u) => [u.user_id, u.name]));
  const peopleNames = new Map(people.map((p) => [p.id, p.name]));
  const topicNames = new Map(topics.map((t) => [t.id, t.name]));
  const label = <T extends string>(options: { value: T; label: string }[], values: T[]) =>
    values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");

  const dateLabel =
    state.date === "custom"
      ? `${state.from || "…"} → ${state.to || "…"}`
      : (DATE_PRESETS.find((p) => p.value === state.date)?.label ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.hosts.length > 0 && (
        <Chip
          label={`Hosted by: ${names(state.hosts, userNames, "Host")}`}
          onRemove={() => onChange({ ...state, hosts: [] })}
        />
      )}
      {state.participants.length > 0 && (
        <Chip
          label={`Participants: ${names(state.participants, peopleNames, "Participant")}`}
          onRemove={() => onChange({ ...state, participants: [] })}
        />
      )}
      {state.date !== "any" && (
        <Chip
          label={`Date: ${dateLabel}`}
          onRemove={() => onChange({ ...state, date: "any", from: "", to: "" })}
        />
      )}
      {state.durations.length > 0 && (
        <Chip
          label={`Duration: ${label(DURATIONS, state.durations)}`}
          onRemove={() => onChange({ ...state, durations: [] })}
        />
      )}
      {state.sources.length > 0 && (
        <Chip
          label={`Captured from: ${label(SOURCES, state.sources)}`}
          onRemove={() => onChange({ ...state, sources: [] })}
        />
      )}
      {state.topics.length > 0 && (
        <Chip
          label={`Topics: ${names(state.topics, topicNames, "Topic")}`}
          onRemove={() => onChange({ ...state, topics: [] })}
        />
      )}
      <button
        type="button"
        onClick={() => onChange(clearedFilters(state))}
        className="text-13 font-medium text-secondary hover:text-title"
      >
        Clear all
      </button>
    </div>
  );
}
