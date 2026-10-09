"use client";

import { CalendarDays, ChevronDown, Mic, Upload, Video } from "lucide-react";

import { useUI } from "@/components/providers/ui-provider";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

/** The purple split "Capture ▾" button from the Fireflies top bar. */
export function CaptureButton() {
  const { openCreateMeeting, openComingSoon } = useUI();
  return (
    <div className="flex h-8 items-stretch overflow-hidden rounded bg-brand text-on-brand">
      <button
        type="button"
        onClick={() => openCreateMeeting("upload")}
        className="flex items-center gap-1.5 px-3 font-display text-sm font-medium hover:bg-brand-hover"
      >
        <Video className="h-4 w-4" />
        <span className="hidden sm:inline">Capture</span>
      </button>
      <Menu>
        <MenuTrigger
          aria-label="More capture options"
          className="flex items-center border-l border-white/25 px-2 hover:bg-brand-hover focus-visible:bg-brand-hover"
        >
          <ChevronDown className="h-4 w-4" />
        </MenuTrigger>
        <MenuContent className="min-w-[230px]">
          <MenuItem
            icon={<Video className="h-4 w-4" />}
            onSelect={() => openComingSoon("Add to live meeting")}
          >
            Add to live meeting
          </MenuItem>
          <MenuItem
            icon={<CalendarDays className="h-4 w-4" />}
            onSelect={() => openComingSoon("Schedule new meeting")}
          >
            Schedule new meeting
          </MenuItem>
          <MenuItem icon={<Upload className="h-4 w-4" />} onSelect={() => openCreateMeeting("upload")}>
            Upload transcript
          </MenuItem>
          <MenuItem icon={<Mic className="h-4 w-4" />} onSelect={() => openComingSoon("Start recording")}>
            Start recording
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
