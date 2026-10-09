"use client";

import { Check, X } from "lucide-react";
import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { Segment, Speaker } from "@/lib/types";

import { speakerColor, splitByMatches, type Block } from "./model";

export interface BlockMatch {
  start: number;
  end: number;
  current: boolean;
}

interface TranscriptBlockProps {
  block: Block;
  segments: Segment[];
  speaker: Speaker | undefined;
  /** Index (into segments) of the sentence being played, if it is in this block; otherwise -1. */
  activeSegment: number;
  /** Search matches for sentences in this block, keyed by segment index. */
  matches: Map<number, BlockMatch[]> | undefined;
  editMode: boolean;
  onSeek: (ms: number) => void;
  onEditSegment: (segment: Segment, text: string) => Promise<void>;
  onRenameSpeaker: (speaker: Speaker, name: string) => Promise<void>;
}

function InlineEditor({
  initial,
  multiline,
  onSave,
  onCancel,
  label,
}: {
  initial: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const save = async () => {
    const next = value.trim();
    if (!next || next === initial) return onCancel();
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onCancel();
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  };
  const className =
    "w-full rounded-md border border-brand bg-surface px-2 py-1 text-15 text-title shadow-focus outline-none";

  return (
    <span className="flex items-start gap-1">
      {multiline ? (
        <textarea
          ref={ref}
          aria-label={label}
          value={value}
          rows={Math.min(6, Math.max(2, Math.ceil(value.length / 48)))}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(className, "resize-none leading-7")}
        />
      ) : (
        <input
          ref={ref}
          aria-label={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(className, "h-7 w-48 text-sm")}
        />
      )}
      <button
        type="button"
        aria-label="Save"
        disabled={saving}
        onClick={() => void save()}
        className="rounded p-1 text-success hover:bg-muted"
      >
        <Check className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Cancel" onClick={onCancel} className="rounded p-1 text-text-muted hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </span>
  );
}

function TranscriptBlockView({
  block,
  segments,
  speaker,
  activeSegment,
  matches,
  editMode,
  onSeek,
  onEditSegment,
  onRenameSpeaker,
}: TranscriptBlockProps) {
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const name = speaker?.name ?? "Unknown speaker";
  // Clicking a sentence seeks the player; in edit mode it opens the sentence editor instead.
  const activate = (index: number, segment: Segment) => {
    if (editMode) setEditingSegment(index);
    else onSeek(segment.start_ms);
  };

  useEffect(() => {
    if (!editMode) {
      setEditingSegment(null);
      setRenaming(false);
    }
  }, [editMode]);

  return (
    <div className="px-4 pb-5 pt-1 sm:px-5">
      <div className="mb-1.5 flex items-center gap-2">
        <Avatar name={name} color={speakerColor(speaker?.color_index ?? 0)} size={20} square single />
        {renaming && speaker ? (
          <InlineEditor
            initial={speaker.name}
            label="Speaker name"
            onCancel={() => setRenaming(false)}
            onSave={async (value) => {
              await onRenameSpeaker(speaker, value);
              setRenaming(false);
            }}
          />
        ) : (
          <button
            type="button"
            disabled={!editMode}
            onClick={() => setRenaming(true)}
            className={cn(
              "text-sm font-medium text-body",
              editMode && "rounded px-1 underline decoration-dashed underline-offset-4 hover:bg-muted",
            )}
            title={editMode ? "Rename speaker" : undefined}
          >
            {name}
          </button>
        )}
        <span aria-hidden className="text-text-muted">
          ·
        </span>
        <button
          type="button"
          onClick={() => onSeek(block.startMs)}
          className="text-sm text-timestamp hover:underline"
          aria-label={`Play from ${formatTimestamp(block.startMs)}`}
        >
          {formatTimestamp(block.startMs)}
        </button>
      </div>

      <p className="pl-7 text-15 leading-[1.85] text-body">
        {block.segments.map((index) => {
          const segment = segments[index] as Segment;
          if (editingSegment === index) {
            return (
              <span key={segment.id} className="my-1 block">
                <InlineEditor
                  initial={segment.text}
                  multiline
                  label="Edit sentence"
                  onCancel={() => setEditingSegment(null)}
                  onSave={async (value) => {
                    await onEditSegment(segment, value);
                    setEditingSegment(null);
                  }}
                />
              </span>
            );
          }
          const segmentMatches = matches?.get(index);
          const active = index === activeSegment;
          return (
            <span key={segment.id}>
              <span
                role="button"
                tabIndex={0}
                data-segment={segment.id}
                onClick={() => activate(index, segment)}
                onKeyDown={(event) => event.key === "Enter" && activate(index, segment)}
                className={cn(
                  "cursor-pointer rounded-sm transition-colors",
                  active ? "bg-playing-bg text-playing-text" : "hover:bg-muted",
                  editMode && "underline decoration-dotted decoration-[var(--border-strong)] underline-offset-4",
                )}
              >
                {segmentMatches
                  ? splitByMatches(segment.text, segmentMatches).map((part, i) =>
                      part.match === "none" ? (
                        <span key={i}>{part.text}</span>
                      ) : (
                        <mark
                          key={i}
                          data-current-match={part.match === "current" || undefined}
                          className={cn(
                            part.match === "current"
                              ? "bg-playing-bg text-playing-text"
                              : "bg-match-bg text-match-text",
                          )}
                        >
                          {part.text}
                        </mark>
                      ),
                    )
                  : segment.text}
              </span>{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}

export const TranscriptBlock = memo(TranscriptBlockView);
