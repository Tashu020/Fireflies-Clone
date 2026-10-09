"use client";

import * as Popover from "@radix-ui/react-popover";
import { Captions, ListTree, Play, Smile, Sparkles, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useUI } from "@/components/providers/ui-provider";
import { useUpdateMeeting } from "@/features/meetings/api";
import { chapterAnchor } from "@/features/notepad/summary-sections";
import { usePlayer, usePlayerState } from "@/features/player/player-context";
import { findActiveIndex } from "@/features/player/player-store";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { Chapter, MeetingDetail, Segment } from "@/lib/types";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Floating "≡" outline on the right edge of the notes: jump to sections and chapters. */
export function OutlineIndex({ chapters, hasKeywords }: { chapters: Chapter[]; hasKeywords: boolean }) {
  const player = usePlayer();
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Outline"
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-muted hover:text-title"
      >
        <ListTree className="h-4 w-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          className="z-50 w-[300px] animate-scale-in rounded-lg border border-line bg-elevated p-2 shadow-lg focus:outline-none"
        >
          <p className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-text-muted">Outline</p>
          <ul className="flex flex-col">
            {[
              ...(hasKeywords ? [{ id: "notes-keywords", label: "Keywords" }] : []),
              { id: "notes-overview", label: "Overview" },
            ].map((section) => (
              <li key={section.id}>
                <Popover.Close
                  onClick={() => scrollToId(section.id)}
                  className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-body hover:bg-muted"
                >
                  {section.label}
                </Popover.Close>
              </li>
            ))}
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <Popover.Close
                  onClick={() => {
                    scrollToId(chapterAnchor(chapter));
                    player.seek(chapter.start_ms);
                  }}
                  className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 pl-4 text-left text-sm text-body hover:bg-muted"
                >
                  <span className="flex-1">{chapter.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    {formatTimestamp(chapter.start_ms)} – {formatTimestamp(chapter.end_ms)}
                  </span>
                </Popover.Close>
              </li>
            ))}
            <li>
              <Popover.Close
                onClick={() => scrollToId("notes-action-items")}
                className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-body hover:bg-muted"
              >
                Action items
              </Popover.Close>
            </li>
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Stand-in for the recording: there's no real video, so it shows live captions of the sentence
 * being played (Fireflies' video view shows synced captions too).
 */
export function VideoPreview({
  segments,
  speakerNames,
  onClose,
}: {
  segments: Segment[];
  speakerNames: Map<number, string>;
  onClose: () => void;
}) {
  const player = usePlayer();
  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);
  const active = usePlayerState((s) => findActiveIndex(starts, s.timeMs));
  const playing = usePlayerState((s) => s.playing);
  const segment = segments[active];

  return (
    <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#19191a] to-[#2b1b6a] text-white">
      <button
        type="button"
        aria-label="Close video"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-md bg-black/30 p-1.5 hover:bg-black/50"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="absolute left-4 top-3 flex items-center gap-1.5 text-xs text-white/70">
        <Captions className="h-4 w-4" /> Audio-only recording · live captions
      </div>
      {!playing && (
        <button
          type="button"
          aria-label="Play"
          onClick={() => player.play()}
          className="absolute left-1/2 top-1/2 flex h-14 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#7a5af8] shadow-lg hover:bg-[#6938ef]"
        >
          <Play className="h-6 w-6 fill-white" />
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-10 text-center">
        {segment ? (
          <p className="text-base leading-snug">
            <span className="font-medium text-[#bdb4fe]">{speakerNames.get(segment.speaker_id)}: </span>
            {segment.text}
          </p>
        ) : (
          <p className="text-sm text-white/60">Press play to start the recording</p>
        )}
      </div>
    </div>
  );
}

export function RateSummary({ meeting }: { meeting: MeetingDetail }) {
  const update = useUpdateMeeting(meeting.id);
  const [hover, setHover] = useState(0);
  const rating = meeting.summary_rating ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line px-4 py-3">
      <Smile className="h-5 w-5 text-text-muted" />
      <span className="text-sm text-body">Did you like the summary?</span>
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`Rate ${value} out of 5`}
            onMouseEnter={() => setHover(value)}
            onClick={() =>
              update.mutate(
                { summary_rating: value },
                { onSuccess: () => toast.success("Thanks for rating the summary!") },
              )
            }
            className="p-0.5"
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors",
                value <= (hover || rating) ? "fill-[#fdb022] text-[#fdb022]" : "text-line-strong",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContinueFromMeeting({ gist }: { gist: string }) {
  const { openComingSoon } = useUI();
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 font-sans text-lg font-medium text-title">
        Continue from this meeting <Sparkles className="h-4 w-4 text-[#fdb022]" />
      </h3>
      {gist && <p className="rounded-lg bg-subtle px-3 py-2.5 text-15 text-secondary">{gist}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {["Attendee Contributions", "Todos", "Meeting Effectiveness"].map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => openComingSoon(`AI Skill: ${skill}`)}
            className="flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-body hover:bg-subtle"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[#5fe9d0] to-[#7a5af8] text-[11px] font-semibold text-white">
              +
            </span>
            {skill}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-muted">Consumes AI credits</p>
    </section>
  );
}
