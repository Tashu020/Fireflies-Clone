"use client";

import { usePlayer } from "@/features/player/player-context";
import { formatTimestamp } from "@/lib/format";

/** "(01:10)" link used in notes and action items; jumps the player (and transcript) there. */
export function TimestampLink({ ms, className }: { ms: number | null; className?: string }) {
  const player = usePlayer();
  if (ms === null) return null;
  return (
    <>
      {" "}
      <span className="whitespace-nowrap">
        (
        <button
          type="button"
          onClick={() => player.seek(ms, { play: true })}
          className={className ?? "text-text-muted hover:text-timestamp hover:underline"}
          aria-label={`Play from ${formatTimestamp(ms)}`}
        >
          {formatTimestamp(ms)}
        </button>
        )
      </span>
    </>
  );
}
