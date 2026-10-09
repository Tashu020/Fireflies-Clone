"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { PlayerStore, type PlayerState } from "@/features/player/player-store";

const PlayerContext = createContext<PlayerStore | null>(null);

export function PlayerProvider({ durationMs, children }: { durationMs: number; children: ReactNode }) {
  const [store] = useState(() => new PlayerStore(durationMs));
  useEffect(() => () => store.destroy(), [store]);
  return <PlayerContext.Provider value={store}>{children}</PlayerContext.Provider>;
}

/** The player's actions (play, pause, seek, ...). Stable — never causes re-renders. */
export function usePlayer(): PlayerStore {
  const store = useContext(PlayerContext);
  if (!store) throw new Error("usePlayer must be used inside PlayerProvider");
  return store;
}

/**
 * Subscribes to a slice of player state. Return a primitive from `selector` so the component only
 * re-renders when that value actually changes (e.g. the active sentence index, not every frame).
 */
export function usePlayerState<T>(selector: (state: PlayerState) => T): T {
  const store = usePlayer();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
