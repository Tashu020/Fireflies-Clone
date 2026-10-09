"use client";

import { FileText, Inbox, Upload, X } from "lucide-react";
import Link from "next/link";
import { useState, type DragEvent } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { useUI } from "@/components/providers/ui-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/controls";
import { useMeetingsInfinite } from "@/features/meetings/api";
import { cn } from "@/lib/cn";
import { formatDuration, formatLongDate } from "@/lib/format";
import { meetingHref } from "@/lib/routes";

/** Fireflies "Uploads" page: a drop zone plus the list of recent uploads. */
export function UploadsPage() {
  const { openCreateMeeting } = useUI();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState(true);
  const { data, isLoading } = useMeetingsInfinite({ channel: "uploads", sort: "recent" });
  const uploads = data?.pages.flatMap((page) => page.items) ?? [];

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) openCreateMeeting("upload", file);
  };

  return (
    <PageFrame title="Uploads">
      <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-6 sm:px-6">
        {notice && (
          <div className="flex items-center gap-3 rounded-lg bg-warning-bg px-4 py-3 text-sm text-body">
            <p className="flex-1 text-center">
              <span className="font-medium text-title">Uploads are moving</span> — you&apos;ll also find them
              on the Meetings page under <span className="font-medium">Uploads</span>.
            </p>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(false)} className="text-text-muted hover:text-title">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : "border-brand-soft-border",
          )}
        >
          <Upload className="mb-4 h-7 w-7 text-brand-accent" />
          <h2 className="text-lg font-medium text-title">Upload a file to generate a transcript</h2>
          <p className="mt-2 text-13 text-text-muted">
            Browse or drag and drop <b>TXT</b>, <b>VTT</b>, <b>SRT</b> or <b>JSON</b> transcript files.
            (Max file size: 5 MB)
          </p>
          <Button variant="primary" size="md" className="mt-6" onClick={() => openCreateMeeting("upload")}>
            Browse Files
          </Button>
          <button
            type="button"
            onClick={() => openCreateMeeting("paste")}
            className="mt-3 text-13 font-medium text-brand-text hover:underline"
          >
            or paste a transcript
          </button>
        </div>

        <section>
          <h2 className="mb-3 text-base font-medium text-title">Recent uploads</h2>
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-lg" />
          ) : uploads.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Inbox className="mb-3 h-10 w-10 text-placeholder" strokeWidth={1.5} />
              <p className="text-lg font-medium text-title">You have no recent uploads!</p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-line">
              {uploads.map((meeting) => (
                <li key={meeting.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={meetingHref(meeting.id, meeting.title)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
                  >
                    <FileText className="h-5 w-5 text-brand-accent" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-title">{meeting.title}</span>
                    <span className="text-13 text-text-muted">
                      {formatLongDate(meeting.started_at)} · {formatDuration(meeting.duration_sec)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
