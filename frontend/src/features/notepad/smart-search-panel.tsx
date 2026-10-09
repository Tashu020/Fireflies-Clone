"use client";

import { ChevronUp, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/controls";
import { useInsights } from "@/features/meetings/api";
import { speakerColor } from "@/features/transcript/model";
import type { TranscriptFilter } from "@/features/transcript/transcript-panel";
import { cn } from "@/lib/cn";
import type { AiFilter } from "@/lib/types";

const AI_FILTERS: { key: AiFilter; label: string; dot: string }[] = [
  { key: "dates", label: "Date & Time", dot: "#15B79E" },
  { key: "tasks", label: "Tasks", dot: "#EF6820" },
  { key: "metrics", label: "Metrics", dot: "#2E90FA" },
  { key: "questions", label: "Questions", dot: "#EE46BC" },
];

const SENTIMENTS = [
  { key: "positive", label: "Positive", dot: "#2E90FA" },
  { key: "neutral", label: "Neutral", dot: "#EE46BC" },
  { key: "negative", label: "Negative", dot: "#EF6820" },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-line px-4 py-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-text-muted"
      >
        {title}
        <ChevronUp className={cn("h-4 w-4 transition-transform", !open && "rotate-180")} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function FilterCard({
  label,
  value,
  dot,
  active,
  onClick,
  disabled,
}: {
  label: string;
  value: ReactNode;
  dot: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center gap-2 rounded-md border px-2.5 text-left text-13 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-brand-soft-border bg-brand-soft text-brand-text"
          : "border-line bg-surface text-body hover:bg-subtle",
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-text-muted">{value}</span>
    </button>
  );
}

/** Fireflies "Smart Search": AI filters, sentiment, speaker talk time and topic trackers. */
export function SmartSearchPanel({
  meetingId,
  activeFilter,
  onFilter,
  onClose,
}: {
  meetingId: string;
  activeFilter: TranscriptFilter | null;
  onFilter: (filter: TranscriptFilter | null) => void;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useInsights(meetingId, true);
  const pick = (label: string, ids: number[]) =>
    onFilter(activeFilter?.label === label ? null : { label, segmentIds: ids });

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <h2 className="font-display text-[15px] font-medium text-title">Smart Search</h2>
        <button type="button" aria-label="Close Smart Search" onClick={onClose} className="rounded p-1 text-text-muted hover:bg-muted hover:text-title">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError || !data ? (
          <p className="p-4 text-sm text-text-muted">Insights are unavailable for this meeting.</p>
        ) : (
          <>
            <Section title="AI Filters">
              <div className="grid grid-cols-2 gap-2">
                {AI_FILTERS.map((filter) => (
                  <FilterCard
                    key={filter.key}
                    label={filter.label}
                    dot={filter.dot}
                    value={data.filters[filter.key].length}
                    active={activeFilter?.label === filter.label}
                    disabled={data.filters[filter.key].length === 0}
                    onClick={() => pick(filter.label, data.filters[filter.key])}
                  />
                ))}
              </div>
            </Section>
            <Section title="Sentiments">
              <div className="flex flex-col gap-2">
                {SENTIMENTS.map((sentiment) => {
                  const label = `${sentiment.label} sentiment`;
                  const ids = data.sentiment[`${sentiment.key}_ids`];
                  return (
                    <FilterCard
                      key={sentiment.key}
                      label={sentiment.label}
                      dot={sentiment.dot}
                      value={`${Math.round(data.sentiment[sentiment.key])}%`}
                      active={activeFilter?.label === label}
                      disabled={ids.length === 0}
                      onClick={() => pick(label, ids)}
                    />
                  );
                })}
              </div>
            </Section>
            <Section title="Speaker Talktime">
              <div className="grid grid-cols-[1fr_48px_72px] gap-y-3 text-xs font-medium uppercase text-text-muted">
                <span>Speakers</span>
                <span className="text-right">WPM</span>
                <span className="text-right">Talktime</span>
              </div>
              <ul className="mt-2 flex flex-col gap-3">
                {data.speakers.map((speaker) => (
                  <li key={speaker.speaker_id}>
                    <div className="grid grid-cols-[1fr_48px_72px] items-center text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-body">
                        <Avatar name={speaker.name} color={speakerColor(speaker.color_index)} size={20} square single />
                        <span className="truncate">{speaker.name}</span>
                      </span>
                      <span className="text-right tabular-nums text-secondary">{speaker.wpm}</span>
                      <span className="text-right tabular-nums text-secondary">{Math.round(speaker.talk_pct)}%</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${speaker.talk_pct}%`, backgroundColor: speakerColor(speaker.color_index) }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Topic Trackers">
              {data.topics.length === 0 ? (
                <p className="text-sm text-text-muted">No topic tracker</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.topics.map((topic) => {
                    const label = `Topic: ${topic.name}`;
                    return (
                      <button
                        key={topic.name}
                        type="button"
                        disabled={topic.count === 0}
                        aria-pressed={activeFilter?.label === label}
                        onClick={() => pick(label, topic.segment_ids)}
                        className={cn(
                          "flex h-7 items-center gap-1.5 rounded-full border px-3 text-13 disabled:opacity-50",
                          activeFilter?.label === label
                            ? "border-brand-soft-border bg-brand-soft text-brand-text"
                            : "border-line text-body hover:bg-subtle",
                        )}
                      >
                        {topic.name}
                        <span className="text-text-muted">{topic.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
