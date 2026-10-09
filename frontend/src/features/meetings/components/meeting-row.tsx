"use client";

import {
  Download,
  Ellipsis,
  FolderInput,
  Link2,
  PanelRightOpen,
  Pencil,
  Share2,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";

import { useUI } from "@/components/providers/ui-provider";
import { AvatarStack } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/controls";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { copyMeetingLink, downloadMeeting } from "@/features/meetings/components/meeting-actions";
import { SourceIcon } from "@/features/meetings/components/source-icon";
import { cn } from "@/lib/cn";
import { formatDuration, formatTime } from "@/lib/format";
import { meetingHref } from "@/lib/routes";
import type { MeetingListItem } from "@/lib/types";

export function MeetingRow({
  meeting,
  selected,
  selectionMode,
  onSelect,
  onDetails,
  onRename,
  onDelete,
}: {
  meeting: MeetingListItem;
  selected: boolean;
  selectionMode: boolean;
  onSelect: (selected: boolean) => void;
  onDetails: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { openComingSoon } = useUI();
  const href = meetingHref(meeting.id, meeting.title);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 border-b border-line px-4 py-3 transition-colors sm:px-6",
        selected ? "bg-brand-soft" : "hover:bg-subtle",
      )}
    >
      <div className={cn("flex w-4 shrink-0", !selectionMode && !selected && "invisible group-hover:visible")}>
        <Checkbox checked={selected} onChange={onSelect} label={`Select ${meeting.title}`} />
      </div>

      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
          <Video className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-title group-hover:text-brand-text">
              {meeting.title}
            </span>
            <SourceIcon source={meeting.source} />
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-13 text-text-muted">
            <span>{formatTime(meeting.started_at)}</span>
            <span aria-hidden>·</span>
            <span>{formatDuration(meeting.duration_sec)}</span>
            {!meeting.is_host && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">Hosted by {meeting.host.name}</span>
              </>
            )}
          </span>
        </span>
      </Link>

      <div className="hidden shrink-0 md:block">
        <AvatarStack people={meeting.participants} max={4} size={26} />
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={onDetails}
          className="hidden h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-13 font-medium text-body shadow-sm hover:bg-subtle sm:flex"
        >
          <PanelRightOpen className="h-3.5 w-3.5" /> Details
        </button>
        <Menu>
          <MenuTrigger
            aria-label={`More actions for ${meeting.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-secondary hover:bg-muted hover:text-title"
          >
            <Ellipsis className="h-4 w-4" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Share2 className="h-4 w-4" />} onSelect={() => openComingSoon("Sharing")}>
              Share
            </MenuItem>
            <MenuItem icon={<Link2 className="h-4 w-4" />} onSelect={() => copyMeetingLink(meeting)}>
              Copy Link
            </MenuItem>
            <MenuSub>
              <MenuSubTrigger icon={<Download className="h-4 w-4" />}>Download</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem onSelect={() => downloadMeeting(meeting.id, "transcript", "txt")}>
                  Transcript (.txt)
                </MenuItem>
                <MenuItem onSelect={() => downloadMeeting(meeting.id, "summary", "md")}>
                  Notes (.md)
                </MenuItem>
                <MenuItem onSelect={() => downloadMeeting(meeting.id, "all", "md")}>
                  Notes + transcript (.md)
                </MenuItem>
              </MenuSubContent>
            </MenuSub>
            <MenuItem icon={<FolderInput className="h-4 w-4" />} onSelect={() => openComingSoon("Channels")}>
              Move to Channel
            </MenuItem>
            <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={onRename}>
              Rename
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 className="h-4 w-4" />} danger onSelect={onDelete}>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}
