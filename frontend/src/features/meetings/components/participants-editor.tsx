"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { usePeople } from "@/features/workspace/api";
import { useDebouncedValue } from "@/lib/hooks";
import type { ParticipantInput } from "@/lib/types";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FALLBACK_COLOR = "#98A2B3";

function sameParticipant(a: ParticipantInput, b: ParticipantInput): boolean {
  if (a.email && b.email) return a.email.toLowerCase() === b.email.toLowerCase();
  return a.name.toLowerCase() === b.name.toLowerCase();
}

/** Chip list of participants with people autocomplete; free text adds a new person. */
export function ParticipantsEditor({
  value,
  onChange,
  colors = {},
}: {
  value: ParticipantInput[];
  onChange: (value: ParticipantInput[]) => void;
  colors?: Record<string, string>;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const debounced = useDebouncedValue(text.trim(), 200);
  const { data: people = [] } = usePeople(debounced);

  const suggestions = people
    .filter((person) => !value.some((p) => sameParticipant(p, person)))
    .slice(0, 6);

  const add = (participant: ParticipantInput) => {
    if (!participant.name.trim() || value.some((p) => sameParticipant(p, participant))) return;
    onChange([...value, participant]);
    setText("");
  };

  const addFromText = () => {
    const raw = text.trim();
    if (!raw) return;
    if (EMAIL.test(raw)) {
      const local = raw.split("@")[0] ?? raw;
      const name = local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ");
      add({ name: name || raw, email: raw.toLowerCase() });
    } else {
      add({ name: raw, email: null });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((participant) => (
            <li
              key={`${participant.email ?? ""}-${participant.name}`}
              className="flex h-7 items-center gap-1.5 rounded-full border border-line bg-subtle pl-1 pr-1.5 text-13 text-body"
            >
              <Avatar
                name={participant.name}
                color={colors[participant.email ?? participant.name] ?? FALLBACK_COLOR}
                size={20}
              />
              <span className="max-w-[160px] truncate">{participant.name}</span>
              <button
                type="button"
                aria-label={`Remove ${participant.name}`}
                onClick={() => onChange(value.filter((p) => p !== participant))}
                className="rounded-full p-0.5 text-text-muted hover:bg-muted hover:text-title"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-brand focus-within:shadow-focus">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFromText();
              }
            }}
            placeholder="Add participant by name or email"
            aria-label="Add participant"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-title outline-none placeholder:text-placeholder focus-visible:shadow-none"
          />
          <button
            type="button"
            onClick={addFromText}
            disabled={!text.trim()}
            className="flex items-center gap-1 text-xs font-medium text-brand-text disabled:text-placeholder"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {focused && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-elevated p-1 shadow-lg">
            {suggestions.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add({ name: person.name, email: person.email })}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <Avatar name={person.name} color={person.avatar_color} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-title">{person.name}</span>
                    {person.email && (
                      <span className="block truncate text-xs text-text-muted">{person.email}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
