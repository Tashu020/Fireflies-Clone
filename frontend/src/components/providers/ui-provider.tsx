"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ComingSoonDialog } from "@/components/layout/coming-soon";
import { GlobalSearchDialog } from "@/components/layout/global-search";
import { CreateMeetingDialog, type CreateTab } from "@/features/meetings/components/create-meeting-dialog";

/**
 * App-wide dialogs that can be opened from anywhere (Capture menu, Home cards, keyboard shortcuts).
 */
interface UIContextValue {
  openCreateMeeting: (tab?: CreateTab, file?: File) => void;
  openComingSoon: (feature: string) => void;
  openSearch: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [createState, setCreateState] = useState<{ open: boolean; tab: CreateTab; file?: File }>({
    open: false,
    tab: "upload",
  });
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const openCreateMeeting = useCallback(
    (tab: CreateTab = "upload", file?: File) => setCreateState({ open: true, tab, file }),
    [],
  );
  const openComingSoon = useCallback((feature: string) => setComingSoon(feature), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ openCreateMeeting, openComingSoon, openSearch }),
    [openCreateMeeting, openComingSoon, openSearch],
  );

  return (
    <UIContext.Provider value={value}>
      {children}
      <CreateMeetingDialog
        open={createState.open}
        initialTab={createState.tab}
        initialFile={createState.file}
        onOpenChange={(open) => setCreateState((state) => ({ ...state, open }))}
      />
      <ComingSoonDialog feature={comingSoon} onClose={() => setComingSoon(null)} />
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside UIProvider");
  return context;
}
