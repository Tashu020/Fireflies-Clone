"use client";

import { Tag } from "lucide-react";
import Link from "next/link";

import { TimestampLink } from "@/features/notepad/timestamp-link";
import { formatTimestamp } from "@/lib/format";
import type { ActionItem, Chapter, MeetingDetail } from "@/lib/types";

export function SectionHeading({ id, children }: { id?: string; children: string }) {
  return (
    <h3 id={id} className="mb-2 scroll-mt-16 font-sans text-base font-medium text-body">
      {children}
    </h3>
  );
}

export function KeywordsSection({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) return null;
  return (
    <section aria-labelledby="notes-keywords">
      <SectionHeading id="notes-keywords">Keywords</SectionHeading>
      <ul className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <li key={keyword}>
            <Link
              href={`/meetings?channel=all&q=${encodeURIComponent(keyword)}`}
              className="flex h-7 items-center gap-1.5 rounded-full border border-line bg-subtle px-3 text-13 text-secondary hover:border-brand-soft-border hover:bg-brand-soft hover:text-brand-text"
              title={`Find meetings about ${keyword}`}
            >
              <Tag className="h-3 w-3" /> {keyword}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewSection({ overview }: { overview: string }) {
  if (!overview) return null;
  return (
    <section aria-labelledby="notes-overview">
      <SectionHeading id="notes-overview">Overview</SectionHeading>
      <p className="text-15 text-body">{overview}</p>
    </section>
  );
}

export function chapterAnchor(chapter: Chapter): string {
  return `chapter-${chapter.id}`;
}

export function NotesSection({ chapters }: { chapters: Chapter[] }) {
  if (chapters.length === 0) return null;
  return (
    <section aria-labelledby="notes-notes">
      <SectionHeading id="notes-notes">Notes</SectionHeading>
      <div className="flex flex-col gap-5">
        {chapters.map((chapter) => (
          <article key={chapter.id} id={chapterAnchor(chapter)} className="scroll-mt-16">
            <h4 className="font-sans text-15 font-medium text-title">{chapter.title}</h4>
            {chapter.intro && <p className="mt-1.5 text-15 text-body">{chapter.intro}</p>}
            {chapter.points.length > 0 && (
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 marker:text-text-muted">
                {chapter.points.map((point) => (
                  <li key={point.id} className="text-15 text-body">
                    <span className="font-medium text-title">{point.text}</span>
                    <TimestampLink ms={point.start_ms} />
                    {point.children.length > 0 && (
                      <ul className="mt-1.5 flex list-[circle] flex-col gap-1.5 pl-5 marker:text-text-muted">
                        {point.children.map((child) => (
                          <li key={child.id} className="font-normal leading-7">
                            {child.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/** Plain-text/Markdown version of the notes for "Copy summary". */
export function summaryAsMarkdown(meeting: MeetingDetail): string {
  const lines: string[] = [`# ${meeting.title}`, ""];
  if (meeting.summary) {
    if (meeting.summary.keywords.length) lines.push(`**Keywords:** ${meeting.summary.keywords.join(", ")}`, "");
    lines.push("## Overview", meeting.summary.overview, "");
  }
  if (meeting.chapters.length) {
    lines.push("## Notes");
    for (const chapter of meeting.chapters) {
      lines.push(`### ${chapter.title}`);
      if (chapter.intro) lines.push(chapter.intro);
      for (const point of chapter.points) {
        const stamp = point.start_ms !== null ? ` (${formatTimestamp(point.start_ms)})` : "";
        lines.push(`- **${point.text}**${stamp}`);
        point.children.forEach((child) => lines.push(`  - ${child.text}`));
      }
      lines.push("");
    }
  }
  if (meeting.action_items.length) {
    lines.push("## Action items");
    const groups = groupByAssignee(meeting.action_items);
    for (const [name, items] of groups) {
      lines.push(`**${name}**`);
      items.forEach((item) => {
        const stamp = item.start_ms !== null ? ` (${formatTimestamp(item.start_ms)})` : "";
        lines.push(`- [${item.is_completed ? "x" : " "}] ${item.text}${stamp}`);
      });
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

export function groupByAssignee(items: ActionItem[]): [string, ActionItem[]][] {
  const groups = new Map<string, ActionItem[]>();
  for (const item of items) {
    const name = item.assignee?.name ?? "Unassigned";
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  // Unassigned goes last; otherwise keep first-appearance order (like Fireflies).
  return [...groups.entries()].sort(([a], [b]) =>
    a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : 0,
  );
}
