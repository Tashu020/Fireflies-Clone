"use client";

import { Check, Globe, Hash, Sparkles, Video } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { Modal } from "@/components/ui/modal";
import { useUpdateMeeting } from "@/features/meetings/api";
import { LANGUAGE_LABELS } from "@/features/meetings/components/meeting-details-sheet";
import { ParticipantsEditor } from "@/features/meetings/components/participants-editor";
import { ApiError } from "@/lib/api";
import { formatLongDate, formatTime, toDateTimeLocal } from "@/lib/format";
import type { MeetingDetail, ParticipantInput } from "@/lib/types";

function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-4 py-3">
      <span className="flex items-center gap-2 text-sm font-medium text-title">{label}</span>
      <div className="min-w-0 text-sm text-body">{children}</div>
    </div>
  );
}

/** Fireflies "Meeting info" modal: privacy, channels, invited and attended people. */
export function MeetingInfoDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: MeetingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const attended = meeting.participants.filter((p) => p.attended);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-line">
            <Video className="h-5 w-5 text-secondary" />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{meeting.title}</span>
            <span className="block text-13 font-normal text-text-muted">
              {meeting.host.name} · {formatLongDate(meeting.started_at)} · {formatTime(meeting.started_at)} ·{" "}
              {LANGUAGE_LABELS[meeting.language] ?? meeting.language}
            </span>
          </span>
        </span>
      }
    >
      {meeting.summary?.gist && (
        <p className="mb-2 flex gap-2.5 rounded-lg bg-brand-soft px-4 py-3 text-sm text-body">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
          {meeting.summary.gist}
        </p>
      )}
      <div className="divide-y divide-[var(--border)] pb-3">
        <InfoRow label="Privacy">
          <span className="flex items-center gap-2 font-medium text-brand-text">
            <Globe className="h-4 w-4" /> Teammates &amp; Anyone with Link
          </span>
        </InfoRow>
        <InfoRow label="Channels">
          <span className="flex flex-wrap gap-4">
            <span className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" /> All Meetings
            </span>
            <span className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" /> My Meetings
            </span>
          </span>
        </InfoRow>
        <InfoRow label="Invited">
          <ul className="flex flex-col gap-3">
            {meeting.participants.map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <Avatar name={person.name} color={person.avatar_color} size={30} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-title">{person.name}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {person.email ?? "No email"}
                    {person.role === "host" ? " · Host" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </InfoRow>
        <InfoRow
          label={
            <>
              Attended
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-bg">
                <Check className="h-3 w-3 text-success-text" />
              </span>
            </>
          }
        >
          <ul className="flex flex-wrap gap-2">
            {attended.map((person) => (
              <li key={person.id} className="flex items-center gap-1.5 rounded-full bg-subtle py-0.5 pl-0.5 pr-2.5">
                <Avatar name={person.name} color={person.avatar_color} size={22} />
                {person.name}
              </li>
            ))}
          </ul>
        </InfoRow>
      </div>
    </Modal>
  );
}

/** Edit title, date/time and participants. */
export function EditMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: MeetingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateMeeting(meeting.id);
  const [title, setTitle] = useState(meeting.title);
  const [startedAt, setStartedAt] = useState(toDateTimeLocal(meeting.started_at));
  const others = meeting.participants.filter((p) => p.role !== "host");
  const [participants, setParticipants] = useState<ParticipantInput[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(meeting.title);
    setStartedAt(toDateTimeLocal(meeting.started_at));
    setParticipants(others.map((p) => ({ name: p.name, email: p.email })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const colors = Object.fromEntries(meeting.participants.map((p) => [p.email ?? p.name, p.avatar_color]));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return toast.error("The title can't be empty");
    update.mutate(
      {
        title: title.trim(),
        started_at: new Date(startedAt).toISOString(),
        participants,
      },
      {
        onSuccess: () => {
          toast.success("Meeting details updated");
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Couldn't update the meeting"),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit meeting details" size="md">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <Field label="Title" htmlFor="edit-title">
          <Input id="edit-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Date & time" htmlFor="edit-date">
          <Input id="edit-date" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </Field>
        <Field
          label="Participants"
          hint={`${meeting.host.name} is the host and is always included.`}
        >
          <ParticipantsEditor value={participants} onChange={setParticipants} colors={colors} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
