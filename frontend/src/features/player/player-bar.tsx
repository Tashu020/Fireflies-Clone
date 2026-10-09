"use client";

import {
  Download,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SquareCheckBig,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";

import { useUI } from "@/components/providers/ui-provider";
import { IconButton } from "@/components/ui/button";
import { Menu, MenuCheckItem, MenuContent, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { usePlayer, usePlayerState } from "@/features/player/player-context";
import { PLAYBACK_RATES, SKIP_MS } from "@/features/player/player-store";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { isTypingTarget } from "@/lib/hooks";

/** Full-width progress line on the top edge of the player bar; click or drag to seek. */
function SeekBar() {
  const player = usePlayer();
  const timeMs = usePlayerState((s) => s.timeMs);
  const durationMs = usePlayerState((s) => s.durationMs);
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const msAt = (clientX: number): { ms: number; x: number } | null => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return { ms: ratio * durationMs, x: ratio * rect.width };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const at = msAt(event.clientX);
    if (at) player.seek(at.ms);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const at = msAt(event.clientX);
    if (!at) return;
    setHover({ x: at.x, ms: at.ms });
    if (dragging) player.seek(at.ms);
  };

  const progress = durationMs > 0 ? (timeMs / durationMs) * 100 : 0;

  return (
    <div
      ref={track}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-valuenow={Math.round(timeMs / 1000)}
      aria-valuetext={`${formatTimestamp(timeMs)} of ${formatTimestamp(durationMs)}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") player.skip(5000);
        if (event.key === "ArrowLeft") player.skip(-5000);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => !dragging && setHover(null)}
      className="group absolute inset-x-0 -top-2 h-4 cursor-pointer touch-none"
    >
      <div className="absolute inset-x-0 top-1.5 h-1 bg-strong transition-[height] group-hover:top-[5px] group-hover:h-1.5">
        <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
      </div>
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-md"
        style={{ left: `${progress}%` }}
      />
      {hover && (
        <div
          className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-[#101828] px-1.5 py-0.5 text-xs font-medium text-white"
          style={{ left: hover.x }}
        >
          {formatTimestamp(hover.ms)}
        </div>
      )}
    </div>
  );
}

function Clock() {
  const timeMs = usePlayerState((s) => Math.floor(s.timeMs / 1000));
  const durationMs = usePlayerState((s) => s.durationMs);
  return (
    <span className="whitespace-nowrap font-display text-sm tabular-nums text-title">
      {formatTimestamp(timeMs * 1000)}
      <span className="text-text-muted"> / {formatTimestamp(durationMs)}</span>
    </span>
  );
}

export function PlayerBar({ onCreateTask }: { onCreateTask: (timeMs: number) => void }) {
  const player = usePlayer();
  const playing = usePlayerState((s) => s.playing);
  const rate = usePlayerState((s) => s.rate);
  const { openComingSoon } = useUI();
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Space toggles playback anywhere on the page (except while typing).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target) && !event.repeat) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button,[role=slider],a")) return;
        event.preventDefault();
        player.toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player]);

  const rateLabel = `${rate}×`;

  return (
    <div className="no-print relative flex h-[68px] shrink-0 items-center border-t border-line bg-player px-3 sm:px-5">
      <SeekBar />
      <div className="flex min-w-0 flex-1 items-center">
        <Clock />
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <Menu>
          <Tooltip content="Playback speed">
            <MenuTrigger className="h-8 min-w-[44px] rounded px-2 font-display text-sm text-secondary hover:bg-muted hover:text-title">
              {rateLabel}
            </MenuTrigger>
          </Tooltip>
          <MenuContent align="center" className="min-w-[140px]">
            <MenuLabel>Speed</MenuLabel>
            {PLAYBACK_RATES.map((option) => (
              <MenuCheckItem key={option} checked={rate === option} onSelect={() => player.setRate(option)}>
                {option}×
              </MenuCheckItem>
            ))}
          </MenuContent>
        </Menu>
        <IconButton label="Back 15 seconds" onClick={() => player.skip(-SKIP_MS)}>
          <RotateCcw className="h-[18px] w-[18px]" />
        </IconButton>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={player.toggle}
          className={cn(
            "flex h-9 w-[54px] items-center justify-center rounded-full shadow-sm transition-colors",
            playing
              ? "border border-line bg-surface text-title hover:bg-subtle"
              : "bg-brand text-on-brand hover:bg-brand-hover",
          )}
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <IconButton label="Forward 15 seconds" onClick={() => player.skip(SKIP_MS)}>
          <RotateCw className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton
          label="Download audio (available on paid plans)"
          className="hidden sm:inline-flex"
          onClick={() => openComingSoon("Audio download")}
        >
          <Download className="h-[18px] w-[18px] opacity-50" />
        </IconButton>
      </div>

      <div className="flex flex-1 items-center justify-end gap-0.5">
        <IconButton label="Bookmark this moment" className="hidden sm:inline-flex" onClick={() => openComingSoon("Bookmarks")}>
          <Star className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton label="Create task at this moment" onClick={() => onCreateTask(player.getState().timeMs)}>
          <SquareCheckBig className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton
          label="Good summary"
          active={feedback === "up"}
          className="hidden sm:inline-flex"
          onClick={() => {
            setFeedback("up");
            toast.success("Thanks for the feedback!");
          }}
        >
          <ThumbsUp className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton
          label="Bad summary"
          active={feedback === "down"}
          className="hidden sm:inline-flex"
          onClick={() => {
            setFeedback("down");
            toast.success("Thanks for the feedback!");
          }}
        >
          <ThumbsDown className="h-[18px] w-[18px]" />
        </IconButton>
      </div>
    </div>
  );
}
