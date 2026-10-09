"use client";

import { CalendarDays, ChevronRight, Play, Settings, Upload, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { LogoMark } from "@/components/layout/logo";
import { PageFrame } from "@/components/layout/page-frame";
import { useUI } from "@/components/providers/ui-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SegmentedControl, Skeleton } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty-state";
import { useRecentMeetings } from "@/features/meetings/api";
import { useMe } from "@/features/workspace/api";
import { cn } from "@/lib/cn";
import { formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { meetingHref } from "@/lib/routes";

type HomeTab = "recent" | "upcoming" | "feed";

function QuickStartCard({
  icon,
  label,
  className,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-[68px] items-center gap-3 rounded-xl border px-5 text-left transition-shadow hover:shadow-md",
        className,
      )}
    >
      <span className="text-secondary">{icon}</span>
      <span className="flex-1 font-display text-base font-medium text-title">{label}</span>
      <ChevronRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function RecentMeetings() {
  const { data, isLoading, isError, refetch } = useRecentMeetings(5);
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title="Couldn't load your meetings"
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }
  const meetings = data?.items ?? [];
  if (meetings.length === 0) {
    return <EmptyState title="No meetings yet" description="Upload a transcript to get started." />;
  }
  return (
    <ul className="flex flex-col">
      {meetings.map((meeting) => (
        <li key={meeting.id}>
          <Link
            href={meetingHref(meeting.id, meeting.title)}
            className="-mx-3 flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-subtle"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
              {meeting.is_host ? (
                <LogoMark size={22} />
              ) : (
                <Avatar name={meeting.host.name} color={meeting.host.avatar_color} size={28} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-title">{meeting.title}</span>
              <span className="text-13 text-text-muted">
                {formatLongDate(meeting.started_at)}, {formatTime(meeting.started_at)}
              </span>
            </span>
            <span className="hidden text-13 text-text-muted sm:block">
              {formatDuration(meeting.duration_sec)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const { data: me } = useMe();
  const { openComingSoon } = useUI();
  const router = useRouter();
  const [tab, setTab] = useState<HomeTab>("recent");
  const firstName = me?.name.split(" ")[0];

  return (
    <PageFrame title="Home">
      <div className="mx-auto flex max-w-[880px] flex-col gap-10 px-4 py-8 sm:px-6">
        <section className="flex flex-col items-center gap-6 overflow-hidden rounded-2xl border border-brand-soft-border bg-gradient-to-br from-[var(--brand-soft)] via-[var(--bg-surface)] to-[var(--playing-bg)] p-6 sm:flex-row sm:p-8">
          <div className="flex-1">
            <h2 className="text-2xl font-normal text-title">
              Welcome Aboard{firstName ? `, ${firstName}` : ""}!
            </h2>
            <p className="mt-2 max-w-sm text-15 text-secondary">
              Fireflies is now ready to automate your meetings and streamline your workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openComingSoon("Product demo video")}
            aria-label="Play product demo"
            className="group relative flex h-[132px] w-[236px] shrink-0 items-center justify-center overflow-hidden rounded-xl border-4 border-[#f7d9c4] bg-gradient-to-br from-[#2b1b6a] to-[#6938ef] shadow-lg"
          >
            <span className="absolute left-4 top-3 text-xs font-medium text-white/80">
              Fireflies · Product Demo
            </span>
            <span className="absolute inset-x-6 bottom-4 top-10 rounded-md border border-white/15 bg-white/5" />
            <span className="relative flex h-10 w-14 items-center justify-center rounded-full bg-[#7a5af8] shadow-md transition-transform group-hover:scale-105">
              <Play className="h-5 w-5 fill-white text-white" />
            </span>
          </button>
        </section>

        <section>
          <h2 className="text-xl font-medium text-title">Quick Start</h2>
          <p className="mt-1 text-sm text-text-muted">
            Capture your first meeting or upload a transcript to see Fireflies in action.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <QuickStartCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="Schedule Meeting"
              className="border-tint-rose-border bg-tint-rose-bg"
              onClick={() => openComingSoon("Meeting scheduling")}
            />
            <QuickStartCard
              icon={<Upload className="h-5 w-5" />}
              label="Upload File"
              className="border-tint-green-border bg-tint-green-bg"
              onClick={() => router.push("/upload")}
            />
            <QuickStartCard
              icon={<Video className="h-5 w-5" />}
              label="Capture Meeting"
              className="border-tint-indigo-border bg-tint-indigo-bg"
              onClick={() => openComingSoon("Live meeting capture")}
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <SegmentedControl<HomeTab>
              ariaLabel="Home feed"
              value={tab}
              onChange={setTab}
              options={[
                { value: "recent", label: "Recent" },
                { value: "upcoming", label: "Upcoming" },
                { value: "feed", label: "AI Feed" },
              ]}
            />
            <Link
              href="/settings/recording"
              className="flex items-center gap-1.5 text-sm text-secondary hover:text-title"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </div>
          {tab === "recent" && <RecentMeetings />}
          {tab === "upcoming" && (
            <EmptyState
              title="No upcoming meetings"
              description="Connect your calendar and Fireflies will join your upcoming meetings automatically."
              action={
                <Button variant="primary" onClick={() => openComingSoon("Calendar integration")}>
                  Connect calendar
                </Button>
              }
            />
          )}
          {tab === "feed" && (
            <EmptyState
              title="Your AI Feed is coming soon"
              description="Quick digests of your past meetings will show up here."
            />
          )}
        </section>
      </div>
    </PageFrame>
  );
}
