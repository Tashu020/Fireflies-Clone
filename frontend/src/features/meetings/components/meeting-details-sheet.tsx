"use client";

import { Check, Globe, Hash, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/modal";
import { sourceLabel } from "@/features/meetings/components/source-icon";
import { formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { meetingHref } from "@/lib/routes";
import type { MeetingListItem } from "@/lib/types";

export const LANGUAGE_LABELS: Record<string, string> = { en: "English (Global)" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5">
      <span className="text-sm font-medium text-title">{label}</span>
      <div className="min-w-0 text-sm text-body">{children}</div>
    </div>
  );
}

export function MeetingDetailsSheet({
  meeting,
  onOpenChange,
}: {
  meeting: MeetingListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={meeting !== null} onOpenChange={onOpenChange} title="Details">
      {meeting && (
        <div className="flex flex-col gap-1 p-5">
          <h3 className="text-lg font-medium text-title">{meeting.title}</h3>
          <p className="text-13 text-text-muted">
            {meeting.host.name} · {formatLongDate(meeting.started_at)} · {formatTime(meeting.started_at)}
          </p>
          {meeting.gist && (
            <p className="mt-3 flex gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm text-body">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
              {meeting.gist}
            </p>
          )}
          <div className="mt-3 divide-y divide-[var(--border)]">
            <Row label="Duration">{formatDuration(meeting.duration_sec)}</Row>
            <Row label="Language">{LANGUAGE_LABELS[meeting.language] ?? meeting.language}</Row>
            <Row label="Captured from">{sourceLabel(meeting.source)}</Row>
            <Row label="Privacy">
              <span className="flex items-center gap-1.5 text-brand-text">
                <Globe className="h-4 w-4" /> Teammates &amp; Anyone with Link
              </span>
            </Row>
            <Row label="Channels">
              <span className="flex flex-wrap gap-3">
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> All Meetings
                </span>
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> My Meetings
                </span>
              </span>
            </Row>
            <Row label="Invited">
              <ul className="flex flex-col gap-2.5">
                {meeting.participants.map((person) => (
                  <li key={person.id} className="flex items-center gap-2.5">
                    <Avatar name={person.name} color={person.avatar_color} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-title">{person.name}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {person.email ?? "No email"}
                        {person.role === "host" && " · Host"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Row>
            <Row label="Attended">
              <ul className="flex flex-col gap-1.5">
                {meeting.participants
                  .filter((person) => person.attended)
                  .map((person) => (
                    <li key={person.id} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-success" />
                      {person.name}
                    </li>
                  ))}
              </ul>
            </Row>
          </div>
          <Link
            href={meetingHref(meeting.id, meeting.title)}
            className="mt-4 flex h-9 items-center justify-center rounded bg-brand text-sm font-medium text-on-brand hover:bg-brand-hover"
          >
            Open meeting
          </Link>
        </div>
      )}
    </Sheet>
  );
}
