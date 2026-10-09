"use client";

import { ClipboardPaste, FileText, PencilLine, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Textarea } from "@/components/ui/controls";
import { Modal } from "@/components/ui/modal";
import { useCreateMeeting, useUploadMeeting } from "@/features/meetings/api";
import { ParticipantsEditor } from "@/features/meetings/components/participants-editor";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { toDateTimeLocal } from "@/lib/format";
import { meetingHref } from "@/lib/routes";
import type { MeetingDetail, ParticipantInput } from "@/lib/types";

export type CreateTab = "upload" | "paste" | "form";

const ACCEPTED = [".txt", ".vtt", ".srt", ".json"];
const MAX_BYTES = 5 * 1024 * 1024;

const PASTE_PLACEHOLDER = `[00:00:05] Alex Morgan: Thanks for joining, let's get started.
[00:00:12] Priya Shah: Sounds good. First item is the launch plan.

Also supported: "Speaker: text" lines, WebVTT, SRT or JSON.`;

function titleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200);
}

export function CreateMeetingDialog({
  open,
  onOpenChange,
  initialTab,
  initialFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: CreateTab;
  initialFile?: File;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<CreateTab>(initialTab);
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState(() => toDateTimeLocal(new Date().toISOString()));
  const [participants, setParticipants] = useState<ParticipantInput[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const createMeeting = useCreateMeeting();
  const uploadMeeting = useUploadMeeting();
  const pending = createMeeting.isPending || uploadMeeting.isPending;

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setTitle(initialFile ? titleFromFile(initialFile.name) : "");
    setStartedAt(toDateTimeLocal(new Date().toISOString()));
    setParticipants([]);
    setFile(initialFile ?? null);
    setText("");
    setDurationMin("30");
    setError(null);
  }, [open, initialTab, initialFile]);

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    const extension = picked.name.slice(picked.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED.includes(extension)) {
      setError("Unsupported file type. Upload a .txt, .vtt, .srt or .json transcript.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("The file is larger than 5 MB.");
      return;
    }
    setError(null);
    setFile(picked);
    if (!title.trim()) setTitle(titleFromFile(picked.name));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files[0]);
  };

  const onCreated = (meeting: MeetingDetail) => {
    toast.success("Meeting created", { description: meeting.title });
    onOpenChange(false);
    router.push(meetingHref(meeting.id, meeting.title));
  };

  const onFailed = (failure: unknown) => {
    const message = failure instanceof ApiError ? failure.message : "Could not create the meeting.";
    setError(message);
    toast.error(message);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const started = startedAt ? new Date(startedAt).toISOString() : undefined;

    if (tab === "upload") {
      if (!file) return setError("Choose a transcript file to upload.");
      const form = new FormData();
      form.append("file", file);
      if (title.trim()) form.append("title", title.trim());
      if (started) form.append("started_at", started);
      form.append("participants", JSON.stringify(participants));
      uploadMeeting.mutate(form, { onSuccess: onCreated, onError: onFailed });
      return;
    }

    if (!title.trim()) return setError("Give the meeting a title.");
    if (tab === "paste" && !text.trim()) return setError("Paste the transcript text.");
    const minutes = Number(durationMin);
    if (tab === "form" && (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440)) {
      return setError("Duration must be between 0 and 1440 minutes.");
    }
    createMeeting.mutate(
      {
        title: title.trim(),
        started_at: started,
        participants,
        ...(tab === "paste"
          ? { transcript_text: text }
          : { duration_sec: Math.round(minutes * 60) }),
      },
      { onSuccess: onCreated, onError: onFailed },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add a meeting"
      description="Upload or paste a transcript and Fireflies will generate notes, chapters and action items."
      size="md"
    >
      <form id="create-meeting-form" onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <SegmentedControl<CreateTab>
          ariaLabel="How to add the meeting"
          value={tab}
          onChange={(value) => {
            setTab(value);
            setError(null);
          }}
          className="self-start"
          options={[
            { value: "upload", label: <><Upload className="h-3.5 w-3.5" /> Upload file</> },
            { value: "paste", label: <><ClipboardPaste className="h-3.5 w-3.5" /> Paste transcript</> },
            { value: "form", label: <><PencilLine className="h-3.5 w-3.5" /> Create manually</> },
          ]}
        />

        {tab === "upload" && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center rounded-lg border border-dashed px-6 py-7 text-center transition-colors",
              dragging ? "border-brand bg-brand-soft" : "border-brand-soft-border bg-subtle",
            )}
          >
            {file ? (
              <>
                <FileText className="mb-2 h-7 w-7 text-brand-accent" />
                <p className="text-sm font-medium text-title">{file.name}</p>
                <p className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="mt-2 text-xs font-medium text-brand-text"
                >
                  Choose a different file
                </button>
              </>
            ) : (
              <>
                <Upload className="mb-2 h-6 w-6 text-brand-accent" />
                <p className="font-display text-sm font-medium text-title">
                  Upload a file to generate notes
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Browse or drag and drop <b>TXT</b>, <b>VTT</b>, <b>SRT</b> or <b>JSON</b>{" "}
                  transcripts (max 5 MB)
                </p>
                <Button
                  variant="primary"
                  className="mt-4"
                  onClick={() => fileInput.current?.click()}
                >
                  Browse Files
                </Button>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
        )}

        <Field label="Title" htmlFor="meeting-title">
          <Input
            id="meeting-title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={tab === "upload" ? "Defaults to the file name" : "e.g. Weekly Product Sync"}
          />
        </Field>

        {tab === "paste" && (
          <Field
            label="Transcript"
            htmlFor="meeting-transcript"
            hint="Timestamps are optional — without them, timing is estimated from speaking pace."
          >
            <Textarea
              id="meeting-transcript"
              rows={8}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={PASTE_PLACEHOLDER}
              className="font-mono text-13"
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time" htmlFor="meeting-date">
            <Input
              id="meeting-date"
              type="datetime-local"
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
            />
          </Field>
          {tab === "form" && (
            <Field label="Duration (minutes)" htmlFor="meeting-duration">
              <Input
                id="meeting-duration"
                type="number"
                min={0}
                max={1440}
                value={durationMin}
                onChange={(event) => setDurationMin(event.target.value)}
              />
            </Field>
          )}
        </div>

        <Field
          label="Participants"
          hint={tab === "form" ? undefined : "Speakers found in the transcript are added automatically."}
        >
          <ParticipantsEditor value={participants} onChange={setParticipants} />
        </Field>

        {error && (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>
            {pending ? "Generating notes…" : "Create meeting"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
