"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, Crosshair, Pencil, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { useRenameSpeaker, useUpdateSegment } from "@/features/meetings/api";
import { usePlayer, usePlayerState } from "@/features/player/player-context";
import { findActiveIndex } from "@/features/player/player-store";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Segment, Speaker, Transcript } from "@/lib/types";

import { buildBlocks, findMatches } from "./model";
import { TranscriptBlock, type BlockMatch } from "./transcript-block";

export interface TranscriptFilter {
  label: string;
  segmentIds: number[];
}

interface TranscriptPanelProps {
  meetingId: string;
  transcript: Transcript | undefined;
  isLoading: boolean;
  filter: TranscriptFilter | null;
  onClearFilter: () => void;
  initialQuery?: string;
  /** Changes whenever the page wants the search box focused (Ctrl+F). */
  focusSearchToken: number;
}

export function TranscriptPanel({
  meetingId,
  transcript,
  isLoading,
  filter,
  onClearFilter,
  initialQuery = "",
  focusSearchToken,
}: TranscriptPanelProps) {
  const player = usePlayer();
  const segments = useMemo(() => transcript?.segments ?? [], [transcript]);
  const speakers = useMemo(
    () => new Map<number, Speaker>((transcript?.speakers ?? []).map((s) => [s.id, s])),
    [transcript],
  );

  // ---- Search ("Find or Replace" box) -------------------------------------------------------
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [current, setCurrent] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSearchToken > 0) {
      searchInput.current?.focus();
      searchInput.current?.select();
    }
  }, [focusSearchToken]);

  const matches = useMemo(() => findMatches(segments, query), [segments, query]);
  useEffect(() => setCurrent(0), [query]);

  // ---- Visible sentences → blocks ----------------------------------------------------------
  const filterIndices = useMemo(() => {
    if (!filter) return null;
    const ids = new Set(filter.segmentIds);
    return segments.flatMap((segment, index) => (ids.has(segment.id) ? [index] : []));
  }, [filter, segments]);

  const visibleIndices = useMemo(() => {
    if (query.trim()) {
      const withMatch = [...new Set(matches.map((m) => m.segmentIndex))];
      return filterIndices ? withMatch.filter((i) => filterIndices.includes(i)) : withMatch;
    }
    return filterIndices ?? undefined;
  }, [query, matches, filterIndices]);

  const blocks = useMemo(() => buildBlocks(segments, visibleIndices), [segments, visibleIndices]);
  const blockOfSegment = useMemo(() => {
    const map = new Map<number, number>();
    blocks.forEach((block, blockIndex) => block.segments.forEach((s) => map.set(s, blockIndex)));
    return map;
  }, [blocks]);

  const matchesBySegment = useMemo(() => {
    const map = new Map<number, BlockMatch[]>();
    matches.forEach((match, index) => {
      const list = map.get(match.segmentIndex) ?? [];
      list.push({ start: match.start, end: match.end, current: index === current });
      map.set(match.segmentIndex, list);
    });
    return map;
  }, [matches, current]);

  // ---- Virtualized list ---------------------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 140,
    overscan: 6,
    getItemKey: (index) => blocks[index]?.key ?? index,
  });

  // ---- Playback sync ------------------------------------------------------------------------
  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);
  // Nothing is highlighted until playback starts (or the user seeks), as in Fireflies.
  const activeSegment = usePlayerState((s) =>
    starts.length && (s.playing || s.timeMs > 0) ? findActiveIndex(starts, s.timeMs) : -1,
  );
  const playing = usePlayerState((s) => s.playing);
  const seekVersion = usePlayerState((s) => s.seekVersion);
  const [autoScroll, setAutoScroll] = useState(true);
  const activeBlock = blockOfSegment.get(activeSegment) ?? -1;

  const scrollToBlock = useCallback(
    (index: number) => {
      if (index >= 0) virtualizer.scrollToIndex(index, { align: "center" });
    },
    [virtualizer],
  );

  // Follow playback while auto-scroll is on.
  useEffect(() => {
    if (playing && autoScroll && !query.trim()) scrollToBlock(activeBlock);
  }, [activeBlock, playing, autoScroll, query, scrollToBlock]);

  // An explicit seek (clicking a timestamp anywhere on the page) re-enables auto-scroll.
  useEffect(() => {
    if (seekVersion === 0) return;
    setAutoScroll(true);
    if (!query.trim()) scrollToBlock(blockOfSegment.get(findActiveIndex(starts, player.getState().timeMs)) ?? -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekVersion]);

  // Deep links (?t=…) seek before the transcript has loaded: scroll there once blocks exist.
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current || blocks.length === 0) return;
    didInitialScroll.current = true;
    const timeMs = player.getState().timeMs;
    if (timeMs > 0 && !query.trim()) {
      const block = blockOfSegment.get(findActiveIndex(starts, timeMs)) ?? -1;
      requestAnimationFrame(() => scrollToBlock(block));
    }
  }, [blocks.length, blockOfSegment, player, query, scrollToBlock, starts]);

  const goToMatch = (index: number) => {
    if (matches.length === 0) return;
    const next = (index + matches.length) % matches.length;
    setCurrent(next);
    const match = matches[next];
    if (match) scrollToBlock(blockOfSegment.get(match.segmentIndex) ?? -1);
  };

  const clearSearch = () => {
    setInput("");
    setQuery("");
  };

  // ---- Editing ------------------------------------------------------------------------------
  const [editMode, setEditMode] = useState(false);
  const renameSpeaker = useRenameSpeaker(meetingId);
  const updateSegment = useUpdateSegment(meetingId);

  const onSeek = useCallback((ms: number) => player.seek(ms, { play: true }), [player]);
  const onEditSegment = useCallback(
    async (segment: Segment, text: string) => {
      try {
        await updateSegment.mutateAsync({ segmentId: segment.id, text });
        toast.success("Transcript updated");
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Couldn't save the change");
        throw error;
      }
    },
    [updateSegment],
  );
  const onRenameSpeaker = useCallback(
    async (speaker: Speaker, name: string) => {
      try {
        await renameSpeaker.mutateAsync({ speakerId: speaker.id, name });
        toast.success(`Speaker renamed to ${name}`);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Couldn't rename the speaker");
        throw error;
      }
    },
    [renameSpeaker],
  );

  // ---- Render -------------------------------------------------------------------------------
  const searching = query.trim().length > 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3 sm:px-5">
        <Tooltip content="Press enter to search" side="top">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-brand focus-within:shadow-focus">
            <Search className="h-4 w-4 shrink-0 text-placeholder" />
            <input
              ref={searchInput}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (!event.target.value) setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (input.trim() !== query.trim()) setQuery(input);
                  else goToMatch(current + (event.shiftKey ? -1 : 1));
                }
                if (event.key === "Escape") clearSearch();
              }}
              placeholder="Find or Replace"
              aria-label="Search the transcript"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-title outline-none placeholder:text-placeholder focus-visible:shadow-none"
            />
            {searching && (
              <>
                <span className="shrink-0 text-xs tabular-nums text-text-muted" aria-live="polite">
                  {matches.length ? `${current + 1}/${matches.length}` : "0/0"}
                </span>
                <button
                  type="button"
                  aria-label="Previous match"
                  onClick={() => goToMatch(current - 1)}
                  className="rounded p-0.5 text-text-muted hover:bg-muted hover:text-title"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next match"
                  onClick={() => goToMatch(current + 1)}
                  className="rounded p-0.5 text-text-muted hover:bg-muted hover:text-title"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </>
            )}
            {(input || searching) && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clearSearch}
                className="rounded p-0.5 text-text-muted hover:bg-muted hover:text-title"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </Tooltip>
        <IconButton
          label={editMode ? "Done editing" : "Edit transcript"}
          active={editMode}
          onClick={() => setEditMode((value) => !value)}
          disabled={segments.length === 0}
        >
          <Pencil className="h-4 w-4" />
        </IconButton>
      </div>

      {(filter || editMode) && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-13 text-brand-text sm:mx-5">
          {editMode ? (
            <span className="flex-1">Editing — click a sentence to fix it, or a speaker name to rename.</span>
          ) : (
            <>
              <span className="flex-1">
                Showing <b>{blocks.length}</b> sentence{blocks.length === 1 ? "" : "s"} · {filter?.label}
              </span>
              <button type="button" onClick={onClearFilter} className="font-medium hover:underline">
                Clear
              </button>
            </>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        onWheel={() => playing && setAutoScroll(false)}
        onTouchMove={() => playing && setAutoScroll(false)}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {isLoading ? (
          <div className="flex flex-col gap-6 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-7 h-3.5 w-[85%]" />
                <Skeleton className="ml-7 h-3.5 w-[70%]" />
              </div>
            ))}
          </div>
        ) : segments.length === 0 ? (
          <EmptyState
            title="No transcript"
            description="This meeting was created without a transcript."
          />
        ) : blocks.length === 0 ? (
          <EmptyState
            title={searching ? `No results for “${query.trim()}”` : "No matching sentences"}
            description="Try a different word or clear the search."
          />
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const block = blocks[item.index];
              if (!block) return null;
              const containsActive = block.segments.includes(activeSegment);
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <TranscriptBlock
                    block={block}
                    segments={segments}
                    speaker={speakers.get(block.speakerId)}
                    activeSegment={containsActive ? activeSegment : -1}
                    matches={searching ? matchesBySegment : undefined}
                    editMode={editMode}
                    onSeek={onSeek}
                    onEditSegment={onEditSegment}
                    onRenameSpeaker={onRenameSpeaker}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {playing && !autoScroll && !searching && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            scrollToBlock(activeBlock);
          }}
          className={cn(
            "absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1.5 text-13 font-medium text-body shadow-lg hover:bg-subtle",
          )}
        >
          <Crosshair className="h-3.5 w-3.5 text-brand-accent" /> Resume auto-scroll
        </button>
      )}
    </div>
  );
}
