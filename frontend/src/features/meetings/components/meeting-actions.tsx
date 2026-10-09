"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/controls";
import { Modal } from "@/components/ui/modal";
import { useDeleteMeeting, useUpdateMeeting } from "@/features/meetings/api";
import { ApiError, downloadUrl } from "@/lib/api";
import { meetingHref } from "@/lib/routes";

interface MeetingRef {
  id: string;
  title: string;
}

export async function copyMeetingLink(meeting: MeetingRef, seconds?: number): Promise<void> {
  const url = `${window.location.origin}${meetingHref(meeting.id, meeting.title, seconds)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  } catch {
    toast.error("Couldn't copy the link");
  }
}

export function downloadMeeting(
  meetingId: string,
  content: "transcript" | "summary" | "all",
  format: "txt" | "md",
): void {
  const link = document.createElement("a");
  link.href = downloadUrl(`/meetings/${meetingId}/export?format=${format}&content=${content}`);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function RenameMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: MeetingRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(meeting.title);
  const update = useUpdateMeeting(meeting.id);

  useEffect(() => {
    if (open) setTitle(meeting.title);
  }, [open, meeting.title]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = title.trim();
    if (!next || next === meeting.title) return onOpenChange(false);
    update.mutate(
      { title: next },
      {
        onSuccess: () => {
          toast.success("Meeting renamed");
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error, "Couldn't rename the meeting")),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Rename meeting" size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <Field label="Title" htmlFor="rename-title">
          <Input
            id="rename-title"
            autoFocus
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!title.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteMeetingDialog({
  meeting,
  open,
  onOpenChange,
  onDeleted,
}: {
  meeting: MeetingRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const remove = useDeleteMeeting();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete meeting?"
      description={
        <>
          <span className="font-medium text-title">{meeting.title}</span> and its transcript, notes
          and action items will be permanently deleted. This action cannot be undone.
        </>
      }
      confirmLabel="Delete"
      loading={remove.isPending}
      onConfirm={() =>
        remove.mutate(meeting.id, {
          onSuccess: () => {
            toast.success("Meeting deleted");
            onOpenChange(false);
            onDeleted?.();
          },
          onError: (error) => toast.error(errorMessage(error, "Couldn't delete the meeting")),
        })
      }
    />
  );
}
