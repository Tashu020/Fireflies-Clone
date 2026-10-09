"use client";

import * as Popover from "@radix-ui/react-popover";
import { ListFilter, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Checkbox, Input } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DATE_PRESETS,
  DURATIONS,
  SOURCES,
  activeFilterCount,
  clearedFilters,
  type DatePreset,
  type LibraryState,
} from "@/features/meetings/filters";
import { usePeople, useTopics, useUsers } from "@/features/workspace/api";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/hooks";

type Category = "hosts" | "participants" | "date" | "duration" | "source" | "topics";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "hosts", label: "Hosted by" },
  { value: "participants", label: "Participants" },
  { value: "date", label: "Date Range" },
  { value: "duration", label: "Duration" },
  { value: "source", label: "Captured From" },
  { value: "topics", label: "Topics" },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function OptionRow({
  checked,
  onToggle,
  children,
  radio,
  name,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  radio?: boolean;
  /** Accessible name of the option. */
  name: string;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
      <span className="flex min-w-0 flex-1 items-center gap-2.5 text-sm text-body">{children}</span>
      {radio ? (
        <input
          type="radio"
          aria-label={name}
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 cursor-pointer accent-[var(--brand)]"
        />
      ) : (
        <Checkbox checked={checked} onChange={onToggle} label={name} />
      )}
    </label>
  );
}

function PeopleOptions({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);
  const { data: people = [] } = usePeople(debounced);
  return (
    <>
      <Input
        leftIcon={<Search className="h-4 w-4" />}
        placeholder="Search by name or email"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        wrapperClassName="mb-2"
      />
      {people.map((person) => (
        <OptionRow
          key={person.id}
          name={person.name}
          checked={selected.includes(person.id)}
          onToggle={() => onChange(toggle(selected, person.id))}
        >
          <Avatar name={person.name} color={person.avatar_color} size={24} />
          <span className="min-w-0">
            <span className="block truncate">{person.name}</span>
            {person.email && <span className="block truncate text-xs text-text-muted">{person.email}</span>}
          </span>
        </OptionRow>
      ))}
      {people.length === 0 && <p className="px-2 py-4 text-sm text-text-muted">No people found.</p>}
    </>
  );
}

function HostOptions({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState("");
  const { data: users = [] } = useUsers();
  const shown = users.filter((user) =>
    `${user.name} ${user.email ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <Input
        leftIcon={<Search className="h-4 w-4" />}
        placeholder="Search host"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        wrapperClassName="mb-2"
      />
      {shown.map((user) => (
        <OptionRow
          key={user.user_id}
          name={user.name}
          checked={selected.includes(user.user_id)}
          onToggle={() => onChange(toggle(selected, user.user_id))}
        >
          <Avatar name={user.name} color={user.avatar_color} size={24} square />
          <span className="min-w-0">
            <span className="block truncate font-medium">{user.name}</span>
            <span className="block truncate text-xs text-text-muted">{user.email}</span>
          </span>
        </OptionRow>
      ))}
    </>
  );
}

function TopicOptions({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const { data: topics = [] } = useTopics();
  return (
    <>
      {topics.map((topic) => (
        <OptionRow
          key={topic.id}
          name={topic.name}
          checked={selected.includes(topic.id)}
          onToggle={() => onChange(toggle(selected, topic.id))}
        >
          <span className="flex-1 truncate">{topic.name}</span>
          <span className="text-xs text-text-muted">{topic.meeting_count}</span>
        </OptionRow>
      ))}
      {topics.length === 0 && <p className="px-2 py-4 text-sm text-text-muted">No topics yet.</p>}
    </>
  );
}

/** Two-pane filter popover (categories on the left, options on the right), as in Fireflies. */
export function FiltersPopover({
  state,
  onChange,
}: {
  state: LibraryState;
  onChange: (state: LibraryState) => void;
}) {
  const [category, setCategory] = useState<Category>("hosts");
  const count = activeFilterCount(state);

  const categoryActive: Record<Category, boolean> = {
    hosts: state.hosts.length > 0,
    participants: state.participants.length > 0,
    date: state.date !== "any",
    duration: state.durations.length > 0,
    source: state.sources.length > 0,
    topics: state.topics.length > 0,
  };

  const clearCategory = () => {
    const reset: Record<Category, Partial<LibraryState>> = {
      hosts: { hosts: [] },
      participants: { participants: [] },
      date: { date: "any", from: "", to: "" },
      duration: { durations: [] },
      source: { sources: [] },
      topics: { topics: [] },
    };
    onChange({ ...state, ...reset[category] });
  };

  return (
    <Popover.Root>
      <Tooltip content="Filters">
        <Popover.Trigger
          aria-label="Filters"
          className={cn(
            "relative flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
            count > 0
              ? "border-brand-soft-border bg-brand-soft text-brand-text"
              : "border-line text-secondary hover:bg-muted",
          )}
        >
          <ListFilter className="h-4 w-4" />
          {count > 0 && <span className="text-xs font-medium">{count}</span>}
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 flex h-[440px] w-[min(620px,calc(100vw-24px))] animate-scale-in overflow-hidden rounded-xl border border-line bg-elevated shadow-xl focus:outline-none"
        >
          <div className="flex w-[200px] shrink-0 flex-col border-r border-line p-2">
            {CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={cn(
                  "flex h-10 items-center justify-between rounded-md px-3 text-left text-[15px]",
                  category === item.value
                    ? "bg-brand-soft font-medium text-brand-text"
                    : "text-body hover:bg-muted",
                )}
              >
                {item.label}
                {categoryActive[item.value] && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
              </button>
            ))}
            <button
              type="button"
              disabled={count === 0}
              onClick={() => onChange(clearedFilters(state))}
              className="mt-auto h-9 rounded-md border border-line text-sm text-secondary hover:bg-muted disabled:text-placeholder disabled:hover:bg-transparent"
            >
              Clear All Filters
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {CATEGORIES.find((c) => c.value === category)?.label}
              </span>
              <button
                type="button"
                onClick={clearCategory}
                disabled={!categoryActive[category]}
                className="text-sm text-brand-text disabled:text-placeholder"
              >
                Clear all
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {category === "hosts" && (
                <HostOptions selected={state.hosts} onChange={(hosts) => onChange({ ...state, hosts })} />
              )}
              {category === "participants" && (
                <PeopleOptions
                  selected={state.participants}
                  onChange={(participants) => onChange({ ...state, participants })}
                />
              )}
              {category === "date" && (
                <>
                  {DATE_PRESETS.map((preset) => (
                    <OptionRow
                      key={preset.value}
                      name={preset.label}
                      radio
                      checked={state.date === preset.value}
                      onToggle={() => onChange({ ...state, date: preset.value as DatePreset })}
                    >
                      {preset.label}
                    </OptionRow>
                  ))}
                  {state.date === "custom" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 px-2">
                      <label className="flex flex-col gap-1 text-xs text-text-muted">
                        From
                        <Input
                          type="date"
                          value={state.from}
                          max={state.to || undefined}
                          onChange={(event) => onChange({ ...state, from: event.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-muted">
                        To
                        <Input
                          type="date"
                          value={state.to}
                          min={state.from || undefined}
                          onChange={(event) => onChange({ ...state, to: event.target.value })}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
              {category === "duration" &&
                DURATIONS.map((option) => (
                  <OptionRow
                    key={option.value}
                    name={option.label}
                    checked={state.durations.includes(option.value)}
                    onToggle={() => onChange({ ...state, durations: toggle(state.durations, option.value) })}
                  >
                    {option.label}
                  </OptionRow>
                ))}
              {category === "source" &&
                SOURCES.map((option) => (
                  <OptionRow
                    key={option.value}
                    name={option.label}
                    checked={state.sources.includes(option.value)}
                    onToggle={() => onChange({ ...state, sources: toggle(state.sources, option.value) })}
                  >
                    {option.label}
                  </OptionRow>
                ))}
              {category === "topics" && (
                <TopicOptions selected={state.topics} onChange={(topics) => onChange({ ...state, topics })} />
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
