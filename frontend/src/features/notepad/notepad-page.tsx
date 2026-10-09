"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/ui/button";
import { SegmentedControl, UnderlineTabs } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty-state";
import { DotsLoader } from "@/components/ui/spinner";
import { useMeeting, useTranscript } from "@/features/meetings/api";
import type { ActionItemsHandle } from "@/features/notepad/action-items-section";
import { AskFredPanel } from "@/features/notepad/askfred-panel";
import { NotepadHeader } from "@/features/notepad/notepad-header";
import { NotesPanel } from "@/features/notepad/notes-panel";
import { SideRail } from "@/features/notepad/side-rail";
import { SmartSearchPanel } from "@/features/notepad/smart-search-panel";
import { PlayerBar } from "@/features/player/player-bar";
import { PlayerProvider, usePlayer } from "@/features/player/player-context";
import { TranscriptPanel, type TranscriptFilter } from "@/features/transcript/transcript-panel";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/hooks";
import type { MeetingDetail } from "@/lib/types";

type RightTab = "transcript" | "askfred";
type NarrowTab = "notes" | RightTab;

function NotepadLayout({ meeting }: { meeting: MeetingDetail }) {
  const searchParams = useSearchParams();
  const player = usePlayer();
  const transcript = useTranscript(meeting.id);
  const isWide = useMediaQuery("(min-width: 1024px)");
  const initialQuery = searchParams.get("q") ?? "";

  const [rightTab, setRightTab] = useState<RightTab>("transcript");
  const [narrowTab, setNarrowTab] = useState<NarrowTab>(initialQuery ? "transcript" : "notes");
  const [smartSearch, setSmartSearch] = useState(false);
  const [filter, setFilter] = useState<TranscriptFilter | null>(null);
  const [expanded, setExpanded] = useState<"notes" | "transcript" | null>(null);
  const [focusSearchToken, setFocusSearchToken] = useState(0);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const actionItems = useRef<ActionItemsHandle>(null);

  // Deep link: /view/...?t=SECONDS positions the player (used by search results and copied links).
  useEffect(() => {
    const seconds = Number(searchParams.get("t"));
    if (Number.isFinite(seconds) && seconds > 0) player.seek(seconds * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTranscript = () => {
    setRightTab("transcript");
    setNarrowTab("transcript");
    if (expanded === "notes") setExpanded(null);
  };

  // Ctrl/⌘+F jumps to the transcript search box instead of the browser's find bar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        showTranscript();
        setFocusSearchToken((value) => value + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const applyFilter = (next: TranscriptFilter | null) => {
    setFilter(next);
    if (next) showTranscript();
  };

  const createTaskAt = (timeMs: number) => {
    setNarrowTab("notes");
    if (expanded === "transcript") setExpanded(null);
    window.setTimeout(() => actionItems.current?.startAdding(timeMs), 50);
  };

  const notes = (
    <NotesPanel
      ref={actionItems}
      meeting={meeting}
      transcript={transcript.data}
      showTabs={isWide}
      expanded={expanded === "notes"}
      onToggleExpand={() => setExpanded((value) => (value === "notes" ? null : "notes"))}
      regenerateOpen={regenerateOpen}
      onRegenerateOpenChange={setRegenerateOpen}
    />
  );
  const transcriptPanel = (
    <TranscriptPanel
      meetingId={meeting.id}
      transcript={transcript.data}
      isLoading={transcript.isLoading}
      filter={filter}
      onClearFilter={() => setFilter(null)}
      initialQuery={initialQuery}
      focusSearchToken={focusSearchToken}
    />
  );
  const askFred = <AskFredPanel meetingId={meeting.id} keywords={meeting.summary?.keywords ?? []} />;

  return (
    <div className="flex h-screen flex-col bg-page">
      <NotepadHeader meeting={meeting} onRegenerate={() => setRegenerateOpen(true)} />

      {isWide ? (
        <div className="flex min-h-0 flex-1">
          <SideRail smartSearchOpen={smartSearch} onToggleSmartSearch={() => setSmartSearch((v) => !v)} />
          {smartSearch && (
            <div className="no-print w-[328px] shrink-0 border-r border-line bg-surface">
              <SmartSearchPanel
                meetingId={meeting.id}
                activeFilter={filter}
                onFilter={applyFilter}
                onClose={() => setSmartSearch(false)}
              />
            </div>
          )}
          {expanded !== "transcript" && (
            <div className="print-expand min-w-0 flex-1 border-r border-line">{notes}</div>
          )}
          {expanded !== "notes" && (
            <div
              className={cn(
                "no-print flex min-w-0 flex-col bg-surface",
                expanded === "transcript" ? "flex-1" : "w-[42%] min-w-[380px] max-w-[620px]",
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-line px-5">
                <UnderlineTabs<RightTab>
                  ariaLabel="Meeting assistant"
                  value={rightTab}
                  onChange={setRightTab}
                  options={[
                    { value: "askfred", label: "AskFred" },
                    { value: "transcript", label: "Transcript" },
                  ]}
                />
                <IconButton
                  label={expanded === "transcript" ? "Exit full width" : "Expand"}
                  onClick={() => setExpanded((value) => (value === "transcript" ? null : "transcript"))}
                >
                  {expanded === "transcript" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </IconButton>
              </div>
              <div className="min-h-0 flex-1">{rightTab === "transcript" ? transcriptPanel : askFred}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="no-print flex shrink-0 justify-center border-b border-line py-2">
            <SegmentedControl<NarrowTab>
              ariaLabel="Meeting view"
              value={narrowTab}
              onChange={setNarrowTab}
              options={[
                { value: "notes", label: "Notes" },
                { value: "transcript", label: "Transcript" },
                { value: "askfred", label: "AskFred" },
              ]}
            />
          </div>
          <div className="print-expand min-h-0 flex-1">
            {narrowTab === "notes" ? notes : narrowTab === "transcript" ? transcriptPanel : askFred}
          </div>
        </div>
      )}

      <PlayerBar onCreateTask={createTaskAt} />
    </div>
  );
}

export function NotepadPage({ meetingId }: { meetingId: string }) {
  const { data: meeting, isLoading, error, refetch } = useMeeting(meetingId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <DotsLoader />
      </div>
    );
  }
  if (!meeting) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <EmptyState
          title={notFound ? "Meeting not found" : "Couldn't load this meeting"}
          description={
            notFound
              ? "It may have been deleted, or the link is incorrect."
              : "Check that the backend is running, then try again."
          }
          action={
            notFound ? (
              <Link href="/meetings" className="text-sm font-medium text-brand-text hover:underline">
                Back to meetings
              </Link>
            ) : (
              <button type="button" onClick={() => refetch()} className="text-sm font-medium text-brand-text hover:underline">
                Try again
              </button>
            )
          }
        />
      </div>
    );
  }

  return (
    <PlayerProvider key={meeting.id} durationMs={meeting.duration_sec * 1000}>
      <NotepadLayout meeting={meeting} />
    </PlayerProvider>
  );
}
