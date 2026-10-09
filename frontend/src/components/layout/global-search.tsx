"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bot, Search, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { HighlightedSnippet } from "@/components/ui/highlighted-snippet";
import { useSearch } from "@/features/workspace/api";
import { formatDuration, formatLongDate, formatTimestamp } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";
import { meetingHref } from "@/lib/routes";

/** Ctrl+K search across meeting titles and transcripts. */
export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const { data, isFetching, isError } = useSearch(debounced);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const withQuery = (href: string) =>
    `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(debounced.trim())}`;

  const results = debounced.trim() ? (data?.results ?? []) : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-overlay" />
        <Dialog.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-32px)] max-w-[680px] -translate-x-1/2 animate-scale-in overflow-hidden rounded-xl border border-line bg-elevated shadow-xl focus:outline-none">
          <Dialog.Title className="sr-only">Search meetings</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search meeting titles and transcripts
          </Dialog.Description>
          <div className="flex h-14 items-center gap-3 border-b border-line px-5">
            <Search className="h-4 w-4 text-placeholder" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                const first = results[0];
                if (event.key === "Enter" && first) {
                  const hit = first.hits[0];
                  go(
                    withQuery(
                      meetingHref(first.meeting.id, first.meeting.title, hit ? hit.start_ms / 1000 : undefined),
                    ),
                  );
                }
              }}
              placeholder="Search by title or keyword.."
              aria-label="Search by title or keyword"
              className="h-full flex-1 bg-transparent text-base text-title outline-none placeholder:text-placeholder focus-visible:shadow-none"
            />
            {isFetching && <Spinner className="h-4 w-4 text-text-muted" />}
            <Dialog.Close
              aria-label="Close search"
              className="rounded p-1 text-text-muted hover:bg-muted hover:text-title"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {debounced.trim() && !isFetching && results.length === 0 && !isError && (
              <p className="px-5 py-10 text-center text-sm text-text-muted">
                No meetings match “{debounced.trim()}”.
              </p>
            )}
            {isError && (
              <p className="px-5 py-10 text-center text-sm text-danger">Search failed. Try again.</p>
            )}
            {results.length > 0 && (
              <ul className="py-2">
                {results.map((result) => (
                  <li key={result.meeting.id} className="px-2">
                    <button
                      type="button"
                      onClick={() => go(withQuery(meetingHref(result.meeting.id, result.meeting.title)))}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-text">
                        <Video className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-title">
                          {result.meeting.title}
                        </span>
                        <span className="text-xs text-text-muted">
                          {formatLongDate(result.meeting.started_at)} ·{" "}
                          {formatDuration(result.duration_sec)}
                          {result.hit_count > 0 &&
                            ` · ${result.hit_count} mention${result.hit_count === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </button>
                    {result.hits.map((hit) => (
                      <button
                        key={hit.segment_id}
                        type="button"
                        onClick={() =>
                          go(
                            withQuery(
                              meetingHref(result.meeting.id, result.meeting.title, hit.start_ms / 1000),
                            ),
                          )
                        }
                        className="ml-11 flex w-[calc(100%-44px)] gap-2 rounded-md px-3 py-1.5 text-left text-13 text-secondary hover:bg-muted"
                      >
                        <span className="shrink-0 font-medium text-timestamp">
                          {formatTimestamp(hit.start_ms)}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-body">{hit.speaker_name}: </span>
                          <HighlightedSnippet snippet={hit.snippet} />
                        </span>
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={() => go("/ask-fred")}
              className="flex w-full items-center gap-3 rounded-lg bg-brand-soft px-4 py-3 text-left hover:bg-brand-soft-hover"
            >
              <Bot className="h-5 w-5 text-brand-accent" />
              <span className="flex-1 text-sm text-body">Ask Fred anything about your meetings</span>
              <span className="text-sm font-medium text-brand-text">Try AskFred</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
