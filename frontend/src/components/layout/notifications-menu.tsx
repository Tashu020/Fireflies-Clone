"use client";

import * as Popover from "@radix-ui/react-popover";
import { Bell, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useRecentMeetings } from "@/features/meetings/api";
import { formatRelative } from "@/lib/format";
import { meetingHref } from "@/lib/routes";

const SEEN_KEY = "ff-notifications-seen-at";

/** "Your meeting notes are ready" notifications for the most recent meetings. */
export function NotificationsMenu() {
  const { data } = useRecentMeetings(6);
  const [seenAt, setSeenAt] = useState<number>(0);

  useEffect(() => {
    try {
      setSeenAt(Number(localStorage.getItem(SEEN_KEY) ?? 0));
    } catch {
      // ignore
    }
  }, []);

  const notifications = useMemo(() => data?.items ?? [], [data]);
  const unread = notifications.filter((m) => new Date(m.started_at).getTime() > seenAt).length;

  const markAllRead = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      // ignore
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
        className="relative flex h-8 w-8 items-center justify-center rounded text-secondary hover:bg-muted hover:text-title"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger ring-2 ring-[var(--bg-surface)]" />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[360px] animate-scale-in rounded-lg border border-line bg-elevated shadow-lg focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-medium text-title">Notifications</h3>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-xs font-medium text-brand-text disabled:text-text-muted"
            >
              Mark all as read
            </button>
          </div>
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {notifications.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-text-muted">You&apos;re all caught up.</li>
            )}
            {notifications.map((meeting) => {
              const isUnread = new Date(meeting.started_at).getTime() > seenAt;
              return (
                <li key={meeting.id}>
                  <Popover.Close asChild>
                    <Link
                      href={meetingHref(meeting.id, meeting.title)}
                      className="flex gap-3 px-4 py-2.5 hover:bg-muted"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-text">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-body">
                          Your meeting notes are ready for{" "}
                          <span className="font-medium text-title">{meeting.title}</span>
                        </span>
                        <span className="text-xs text-text-muted">
                          {formatRelative(meeting.started_at)}
                        </span>
                      </span>
                      {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    </Link>
                  </Popover.Close>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
