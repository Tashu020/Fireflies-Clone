import type { Segment } from "@/lib/types";

/** Speaker avatar colors, matching the backend palette (speakers.color_index). */
export const SPEAKER_COLORS = [
  "#7A5AF8",
  "#12B76A",
  "#F79009",
  "#2E90FA",
  "#EE46BC",
  "#15B79E",
  "#EF6820",
  "#6172F3",
];

export function speakerColor(colorIndex: number): string {
  return SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length] ?? "#7A5AF8";
}

/** A rendered transcript block: one speaker header followed by consecutive sentences. */
export interface Block {
  key: string;
  speakerId: number;
  startMs: number;
  /** Indices into the transcript's `segments` array. */
  segments: number[];
}

const MAX_BLOCK_MS = 45_000;
const MAX_BLOCK_SENTENCES = 8;

/**
 * Groups consecutive sentences by speaker. Long monologues are split (as Fireflies does every
 * ~30-45s) so each block gets its own timestamp and the virtualized list stays smooth.
 * When `onlyIndices` is given (search / Smart Search filter), each sentence is its own block.
 */
export function buildBlocks(segments: Segment[], onlyIndices?: number[]): Block[] {
  if (onlyIndices) {
    return onlyIndices.map((index) => {
      const segment = segments[index] as Segment;
      return { key: `s-${segment.id}`, speakerId: segment.speaker_id, startMs: segment.start_ms, segments: [index] };
    });
  }
  const blocks: Block[] = [];
  segments.forEach((segment, index) => {
    const current = blocks[blocks.length - 1];
    const sameSpeaker = current?.speakerId === segment.speaker_id;
    const fits =
      current !== undefined &&
      segment.start_ms - current.startMs < MAX_BLOCK_MS &&
      current.segments.length < MAX_BLOCK_SENTENCES;
    if (current && sameSpeaker && fits) {
      current.segments.push(index);
    } else {
      blocks.push({ key: `b-${segment.id}`, speakerId: segment.speaker_id, startMs: segment.start_ms, segments: [index] });
    }
  });
  return blocks;
}

export interface TextMatch {
  segmentIndex: number;
  start: number;
  end: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** All case-insensitive occurrences of `query` across the transcript, in reading order. */
export function findMatches(segments: Segment[], query: string): TextMatch[] {
  const needle = query.trim();
  if (!needle) return [];
  const pattern = new RegExp(escapeRegExp(needle), "gi");
  const matches: TextMatch[] = [];
  segments.forEach((segment, segmentIndex) => {
    for (const match of segment.text.matchAll(pattern)) {
      const start = match.index ?? 0;
      matches.push({ segmentIndex, start, end: start + match[0].length });
    }
  });
  return matches;
}

/** Splits text into plain / highlighted parts for rendering search matches. */
export function splitByMatches(
  text: string,
  matches: { start: number; end: number; current: boolean }[],
): { text: string; match: "none" | "match" | "current" }[] {
  const parts: { text: string; match: "none" | "match" | "current" }[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start), match: "none" });
    parts.push({ text: text.slice(match.start, match.end), match: match.current ? "current" : "match" });
    cursor = match.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: "none" });
  return parts;
}
