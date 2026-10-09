import { Globe, Monitor, Smartphone, Upload, type LucideIcon } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import type { MeetingSource } from "@/lib/types";

const SOURCES: Partial<Record<MeetingSource, { icon: LucideIcon; label: string }>> = {
  chrome_extension: { icon: Globe, label: "Captured with the Chrome extension" },
  desktop: { icon: Monitor, label: "Captured with the desktop app" },
  mobile: { icon: Smartphone, label: "Recorded on the mobile app" },
  upload: { icon: Upload, label: "Uploaded" },
  paste: { icon: Upload, label: "Uploaded (pasted transcript)" },
  form: { icon: Upload, label: "Added manually" },
};

/** Capture-method icon next to a meeting title; meetings joined by the notetaker have none. */
export function SourceIcon({ source }: { source: MeetingSource }) {
  const entry = SOURCES[source];
  if (!entry) return null;
  const Icon = entry.icon;
  return (
    <Tooltip content={entry.label}>
      <span className="inline-flex text-text-muted" aria-label={entry.label}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    </Tooltip>
  );
}

export function sourceLabel(source: MeetingSource): string {
  switch (source) {
    case "notetaker":
      return "Meeting Notetaker";
    case "chrome_extension":
      return "Chrome Extension";
    case "desktop":
      return "Desktop App";
    case "mobile":
      return "Mobile App";
    default:
      return "Uploads";
  }
}
