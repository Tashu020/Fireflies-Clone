"use client";

import {
  Download,
  Ellipsis,
  Globe,
  Info,
  Link2,
  Menu as MenuIcon,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NavDrawer } from "@/components/layout/nav-drawer";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { useUI } from "@/components/providers/ui-provider";
import { Button, IconButton } from "@/components/ui/button";
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
import { Tooltip } from "@/components/ui/tooltip";
import {
  DeleteMeetingDialog,
  RenameMeetingDialog,
  copyMeetingLink,
  downloadMeeting,
} from "@/features/meetings/components/meeting-actions";
import { EditMeetingDialog, MeetingInfoDialog } from "@/features/notepad/meeting-dialogs";
import type { MeetingDetail } from "@/lib/types";

export function NotepadHeader({
  meeting,
  onRegenerate,
}: {
  meeting: MeetingDetail;
  onRegenerate: () => void;
}) {
  const router = useRouter();
  const { openComingSoon, openCreateMeeting } = useUI();
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | "info" | "edit" | null>(null);
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-3">
      <IconButton label="Open navigation" onClick={() => setDrawer(true)}>
        <MenuIcon className="h-5 w-5" />
      </IconButton>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <Link href="/meetings" className="hidden shrink-0 text-secondary hover:text-title sm:block">
          #My Meetings
        </Link>
        <span aria-hidden className="hidden text-text-muted sm:block">
          /
        </span>
        <span className="truncate font-medium text-title">{meeting.title}</span>
      </nav>

      <Menu>
        <MenuTrigger
          aria-label="Meeting options"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-secondary hover:bg-muted hover:text-title"
        >
          <Ellipsis className="h-4 w-4" />
        </MenuTrigger>
        <MenuContent align="start" className="min-w-[220px]">
          <MenuItem icon={<Share2 className="h-4 w-4" />} onSelect={() => openComingSoon("Sharing")}>
            Share
          </MenuItem>
          <MenuItem icon={<Link2 className="h-4 w-4" />} onSelect={() => copyMeetingLink(meeting)}>
            Copy link
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<RefreshCw className="h-4 w-4" />} onSelect={onRegenerate} disabled={meeting.segment_count === 0}>
            Regenerate notes
          </MenuItem>
          <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => setDialog("rename")}>
            Rename
          </MenuItem>
          <MenuItem icon={<Users className="h-4 w-4" />} onSelect={() => setDialog("edit")}>
            Edit details &amp; participants
          </MenuItem>
          <MenuItem icon={<Globe className="h-4 w-4" />} onSelect={() => openComingSoon("Meeting languages")}>
            Update language
          </MenuItem>
          <MenuItem icon={<Info className="h-4 w-4" />} onSelect={() => setDialog("info")}>
            Meeting info
          </MenuItem>
          <MenuSub>
            <MenuSubTrigger icon={<Download className="h-4 w-4" />}>Download</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem onSelect={() => downloadMeeting(meeting.id, "transcript", "txt")}>Transcript (.txt)</MenuItem>
              <MenuItem onSelect={() => downloadMeeting(meeting.id, "summary", "md")}>Notes (.md)</MenuItem>
              <MenuItem onSelect={() => downloadMeeting(meeting.id, "all", "md")}>Notes + transcript (.md)</MenuItem>
              <MenuItem onSelect={() => window.print()}>Notes (PDF / Print)</MenuItem>
            </MenuSubContent>
          </MenuSub>
          <MenuSeparator />
          <MenuItem icon={<Trash2 className="h-4 w-4" />} danger onSelect={() => setDialog("delete")}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button variant="upgrade" className="hidden lg:inline-flex" onClick={() => openComingSoon("Paid plans")}>
          Upgrade
        </Button>
        <div className="flex h-8 items-stretch overflow-hidden rounded bg-brand text-on-brand">
          <button
            type="button"
            onClick={() => openComingSoon("Sharing")}
            className="flex items-center gap-1.5 px-3 font-display text-sm font-medium hover:bg-brand-hover"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <Tooltip content="Copy link">
            <button
              type="button"
              aria-label="Copy link"
              onClick={() => copyMeetingLink(meeting)}
              className="flex items-center border-l border-white/25 px-2 hover:bg-brand-hover"
            >
              <Link2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
        <IconButton label="Add a meeting" className="hidden border border-line sm:inline-flex" onClick={() => openCreateMeeting("upload")}>
          <Plus className="h-4 w-4" />
        </IconButton>
        <NotificationsMenu />
        <ProfileMenu />
      </div>

      <NavDrawer open={drawer} onOpenChange={setDrawer} />
      <RenameMeetingDialog meeting={meeting} open={dialog === "rename"} onOpenChange={close} />
      <EditMeetingDialog meeting={meeting} open={dialog === "edit"} onOpenChange={close} />
      <MeetingInfoDialog meeting={meeting} open={dialog === "info"} onOpenChange={close} />
      <DeleteMeetingDialog
        meeting={meeting}
        open={dialog === "delete"}
        onOpenChange={close}
        onDeleted={() => router.push("/meetings")}
      />
    </header>
  );
}
