"use client";

import { ChevronDown, Copy, Maximize2, Minimize2, RefreshCw, Sparkles, Video } from "lucide-react";
import { forwardRef, useMemo, useState } from "react";
import { toast } from "sonner";

import { useUI } from "@/components/providers/ui-provider";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuCheckItem, MenuContent, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { useRegenerateSummary } from "@/features/meetings/api";
import { LANGUAGE_LABELS } from "@/features/meetings/components/meeting-details-sheet";
import { SourceIcon } from "@/features/meetings/components/source-icon";
import { ActionItemsSection, type ActionItemsHandle } from "@/features/notepad/action-items-section";
import {
  ContinueFromMeeting,
  OutlineIndex,
  RateSummary,
  VideoPreview,
} from "@/features/notepad/notes-extras";
import {
  KeywordsSection,
  NotesSection,
  OverviewSection,
  summaryAsMarkdown,
} from "@/features/notepad/summary-sections";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { MeetingDetail, Transcript } from "@/lib/types";

const TEMPLATES = ["General Summary", "Sales (BANT)", "Candidate Feedback", "Project Update"];

interface NotesPanelProps {
  meeting: MeetingDetail;
  transcript: Transcript | undefined;
  expanded: boolean;
  onToggleExpand?: () => void;
  /** Shows the Notes | AI Skills tabs (hidden on narrow screens, where the page has its own tabs). */
  showTabs: boolean;
  /** The "Regenerate notes" confirmation can also be opened from the header menu. */
  regenerateOpen: boolean;
  onRegenerateOpenChange: (open: boolean) => void;
}

export const NotesPanel = forwardRef<ActionItemsHandle, NotesPanelProps>(function NotesPanel(
  { meeting, transcript, expanded, onToggleExpand, showTabs, regenerateOpen, onRegenerateOpenChange },
  actionItemsRef,
) {
  const { openComingSoon } = useUI();
  const [tab, setTab] = useState<"notes" | "skills">("notes");
  const [showVideo, setShowVideo] = useState(false);
  const regenerate = useRegenerateSummary(meeting.id);
  const speakerNames = useMemo(
    () => new Map((transcript?.speakers ?? meeting.speakers).map((s) => [s.id, s.name])),
    [transcript, meeting.speakers],
  );

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryAsMarkdown(meeting));
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't copy the summary");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showTabs && (
        <div className="relative flex h-14 shrink-0 items-center justify-center border-b border-line px-4">
          <SegmentedControl
            ariaLabel="Notes view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "notes", label: "Notes" },
              { value: "skills", label: <>AI Skills <span className="text-text-muted">· 0</span></> },
            ]}
          />
          {onToggleExpand && (
            <IconButton
              label={expanded ? "Exit full width" : "Expand notes"}
              className="absolute right-4"
              onClick={onToggleExpand}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconButton>
          )}
        </div>
      )}

      <div id="notes-scroll" className="print-expand min-h-0 flex-1 overflow-y-auto">
        {tab === "skills" ? (
          <EmptyState
            title="No AI Skills have run on this meeting"
            description="AI Skills extract objections, scorecards, follow-up emails and more."
            action={
              <button
                type="button"
                onClick={() => openComingSoon("AI Skills")}
                className="text-sm font-medium text-brand-text hover:underline"
              >
                Browse AI Skills
              </button>
            }
          />
        ) : (
          <div className="mx-auto w-full max-w-[760px] px-5 pb-16 pt-6 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-2xl font-normal text-title">{meeting.title}</h1>
              <button
                type="button"
                onClick={() => setShowVideo((value) => !value)}
                disabled={meeting.segment_count === 0}
                className="flex h-9 shrink-0 items-center gap-2 rounded border border-line px-3.5 font-display text-sm font-medium text-secondary hover:bg-subtle disabled:opacity-50"
              >
                <Video className="h-4 w-4" /> Video
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
              <Avatar name={meeting.host.name} color={meeting.host.avatar_color} size={18} square />
              <span className="text-secondary underline decoration-[var(--border-strong)] underline-offset-2">
                {meeting.host.name}
              </span>
              <span>{formatDateTime(meeting.started_at)}</span>
              <SourceIcon source={meeting.source} />
              <span>· {LANGUAGE_LABELS[meeting.language] ?? meeting.language}</span>
            </div>

            {showVideo && transcript && (
              <div className="mt-5">
                <VideoPreview
                  segments={transcript.segments}
                  speakerNames={speakerNames}
                  onClose={() => setShowVideo(false)}
                />
              </div>
            )}

            {meeting.summary ? (
              <>
                <div className="sticky top-0 z-[2] -mx-2 mt-8 flex items-center gap-1 bg-page px-2 py-2">
                  <Menu>
                    <MenuTrigger className="flex h-8 items-center gap-1.5 rounded-md px-2 font-display text-sm font-medium text-text-muted hover:bg-muted hover:text-title">
                      <Sparkles className="h-4 w-4" /> General Summary <ChevronDown className="h-3.5 w-3.5" />
                    </MenuTrigger>
                    <MenuContent align="start">
                      <MenuLabel>Summary template</MenuLabel>
                      {TEMPLATES.map((template) => (
                        <MenuCheckItem
                          key={template}
                          checked={template === "General Summary"}
                          onSelect={() =>
                            template !== "General Summary" && openComingSoon(`${template} template`)
                          }
                        >
                          {template}
                        </MenuCheckItem>
                      ))}
                    </MenuContent>
                  </Menu>
                  <IconButton label="Copy summary" onClick={copySummary}>
                    <Copy className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Regenerate notes"
                    onClick={() => onRegenerateOpenChange(true)}
                    disabled={meeting.segment_count === 0}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </IconButton>
                  <div className="ml-auto">
                    <OutlineIndex chapters={meeting.chapters} hasKeywords={meeting.summary.keywords.length > 0} />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-8">
                  <KeywordsSection keywords={meeting.summary.keywords} />
                  <OverviewSection overview={meeting.summary.overview} />
                  <NotesSection chapters={meeting.chapters} />
                  <ActionItemsSection
                    ref={actionItemsRef}
                    meetingId={meeting.id}
                    items={meeting.action_items}
                    participants={meeting.participants}
                    durationMs={meeting.duration_sec * 1000}
                  />
                  <RateSummary meeting={meeting} />
                  <ContinueFromMeeting gist={meeting.summary.gist} />
                </div>
              </>
            ) : (
              <div className="mt-8 flex flex-col gap-8">
                <div className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-center">
                  <p className="font-medium text-title">No AI notes for this meeting</p>
                  <p className="mt-1 text-sm text-text-muted">
                    This meeting was added without a transcript, so there&apos;s nothing to summarize.
                    You can still track action items below.
                  </p>
                </div>
                <ActionItemsSection
                  ref={actionItemsRef}
                  meetingId={meeting.id}
                  items={meeting.action_items}
                  participants={meeting.participants}
                  durationMs={meeting.duration_sec * 1000}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={regenerateOpen}
        onOpenChange={onRegenerateOpenChange}
        title="Regenerate notes?"
        description="Fireflies will rewrite the summary, chapters and AI action items from the current transcript. Action items you added yourself are kept."
        confirmLabel="Regenerate"
        destructive={false}
        loading={regenerate.isPending}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: () => {
              toast.success("Notes regenerated");
              onRegenerateOpenChange(false);
            },
            onError: (error) =>
              toast.error(error instanceof ApiError ? error.message : "Couldn't regenerate the notes"),
          })
        }
      />
    </div>
  );
});
