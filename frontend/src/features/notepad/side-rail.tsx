"use client";

import { AudioLines, Bookmark, MessageSquare, ScanSearch, Smile } from "lucide-react";

import { useUI } from "@/components/providers/ui-provider";
import { IconButton } from "@/components/ui/button";

/** Vertical icon rail on the left of the notepad (Smart Search, Soundbites, Comments, Bookmarks). */
export function SideRail({
  smartSearchOpen,
  onToggleSmartSearch,
}: {
  smartSearchOpen: boolean;
  onToggleSmartSearch: () => void;
}) {
  const { openComingSoon } = useUI();
  return (
    <div className="no-print flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
      <IconButton label="Smart Search" active={smartSearchOpen} onClick={onToggleSmartSearch}>
        <ScanSearch className="h-[18px] w-[18px]" />
      </IconButton>
      <IconButton label="Soundbites" onClick={() => openComingSoon("Soundbites")}>
        <AudioLines className="h-[18px] w-[18px]" />
      </IconButton>
      <IconButton label="Comments" onClick={() => openComingSoon("Comments")}>
        <MessageSquare className="h-[18px] w-[18px]" />
      </IconButton>
      <IconButton label="Bookmarks" onClick={() => openComingSoon("Bookmarks")}>
        <Bookmark className="h-[18px] w-[18px]" />
      </IconButton>
      <div className="mt-auto">
        <IconButton label="Share feedback" onClick={() => openComingSoon("Feedback")}>
          <Smile className="h-[18px] w-[18px]" />
        </IconButton>
      </div>
    </div>
  );
}
