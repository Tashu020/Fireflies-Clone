/**
 * Media clock for the meeting player.
 *
 * Recordings are out of scope, so playback is simulated: a requestAnimationFrame loop advances the
 * current time by real elapsed time × playback rate. The store lives outside React state and
 * notifies subscribers, so only components that read the time (seek bar, clock, active sentence)
 * re-render while playing — not the whole page.
 */
export interface PlayerState {
  timeMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  /** Increments on every explicit seek, so views can react (e.g. scroll the transcript). */
  seekVersion: number;
}

type Listener = () => void;

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const SKIP_MS = 15_000;

export class PlayerStore {
  private state: PlayerState;
  private listeners = new Set<Listener>();
  private frame: number | null = null;
  private lastTick = 0;

  constructor(durationMs: number) {
    this.state = { timeMs: 0, durationMs: Math.max(0, durationMs), playing: false, rate: 1, seekVersion: 0 };
  }

  getState = (): PlayerState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private tick = (now: number): void => {
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    const next = this.state.timeMs + elapsed * this.state.rate;
    if (next >= this.state.durationMs) {
      this.stopLoop();
      this.set({ timeMs: this.state.durationMs, playing: false });
      return;
    }
    this.set({ timeMs: next });
    this.frame = requestAnimationFrame(this.tick);
  };

  private stopLoop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  play = (): void => {
    if (this.state.playing || this.state.durationMs === 0) return;
    const restart = this.state.timeMs >= this.state.durationMs;
    this.set({ playing: true, ...(restart ? { timeMs: 0 } : {}) });
    this.lastTick = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  };

  pause = (): void => {
    this.stopLoop();
    if (this.state.playing) this.set({ playing: false });
  };

  toggle = (): void => (this.state.playing ? this.pause() : this.play());

  seek = (timeMs: number, options: { play?: boolean } = {}): void => {
    const clamped = Math.min(Math.max(0, timeMs), this.state.durationMs);
    this.lastTick = performance.now();
    this.set({ timeMs: clamped, seekVersion: this.state.seekVersion + 1 });
    if (options.play) this.play();
  };

  skip = (deltaMs: number): void => this.seek(this.state.timeMs + deltaMs);

  setRate = (rate: number): void => this.set({ rate });

  destroy = (): void => {
    this.stopLoop();
    this.listeners.clear();
  };
}

/** Index of the last item whose start is <= time (binary search), or -1. */
export function findActiveIndex(starts: number[], timeMs: number): number {
  let low = 0;
  let high = starts.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((starts[mid] ?? Infinity) <= timeMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
