"use client";

import { ArrowDownUp, Plus, Search, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PageFrame } from "@/components/layout/page-frame";
import { useUI } from "@/components/providers/ui-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Skeleton } from "@/components/ui/controls";
import { EmptyState, StackedCardsIllustration } from "@/components/ui/empty-state";
import { Menu, MenuCheckItem, MenuContent, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteMeeting, useMeetingsInfinite } from "@/features/meetings/api";
import { ChannelSidebar } from "@/features/meetings/components/channel-sidebar";
import { FilterChips } from "@/features/meetings/components/filter-chips";
import { FiltersPopover } from "@/features/meetings/components/filters-popover";
import { DeleteMeetingDialog, RenameMeetingDialog } from "@/features/meetings/components/meeting-actions";
import { MeetingDetailsSheet } from "@/features/meetings/components/meeting-details-sheet";
import { MeetingRow } from "@/features/meetings/components/meeting-row";
import {
  activeFilterCount,
  clearedFilters,
  parseLibraryState,
  serializeLibraryState,
  toApiFilters,
  type LibraryState,
} from "@/features/meetings/filters";
import { cn } from "@/lib/cn";
import { dayKey, formatDayHeader } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";
import type { MeetingListItem } from "@/lib/types";

function ListSkeleton() {
  return (
    <div aria-busy>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line px-6 py-3.5">
          <Skeleton className="ml-7 h-10 w-10 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full md:block" />
        </div>
      ))}
    </div>
  );
}

export function MeetingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openCreateMeeting } = useUI();

  const state = useMemo(() => parseLibraryState(new URLSearchParams(searchParams.toString())), [searchParams]);
  const setState = (next: LibraryState) => {
    const query = serializeLibraryState(next);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // The search box updates the URL after a short pause, not on every keystroke.
  const [searchText, setSearchText] = useState(state.q);
  const debouncedSearch = useDebouncedValue(searchText, 300);
  useEffect(() => {
    if (debouncedSearch !== state.q) setState({ ...state, q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters = useMemo(() => toApiFilters(state), [state]);
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useMeetingsInfinite(filters);
  const meetings = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const groups = useMemo(() => {
    const result: { key: string; label: string; items: MeetingListItem[] }[] = [];
    for (const meeting of meetings) {
      const key = dayKey(meeting.started_at);
      const last = result[result.length - 1];
      if (last && last.key === key) last.items.push(meeting);
      else result.push({ key, label: formatDayHeader(meeting.started_at), items: [meeting] });
    }
    return result;
  }, [meetings]);

  // Infinite scroll: load the next page when the sentinel becomes visible.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<MeetingListItem | null>(null);
  const [renaming, setRenaming] = useState<MeetingListItem | null>(null);
  const [deleting, setDeleting] = useState<MeetingListItem | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const deleteMeeting = useDeleteMeeting();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => setSelected(new Set()), [state]);

  const toggleSelected = (ids: string[], value: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
      return next;
    });

  const bulkDelete = async () => {
    setBulkDeleting(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => deleteMeeting.mutateAsync(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false);
    setBulkConfirm(false);
    setSelected(new Set());
    if (failed) toast.error(`${failed} meeting${failed === 1 ? "" : "s"} could not be deleted`);
    else toast.success(`${ids.length} meeting${ids.length === 1 ? "" : "s"} deleted`);
  };

  const filtersApplied = activeFilterCount(state) > 0 || state.q.trim() !== "" || state.quick !== null;

  return (
    <PageFrame title="Meetings" scroll={false}>
      <div className="flex h-full">
        <ChannelSidebar channel={state.channel} onChange={(channel) => setState({ ...state, channel })} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-9 items-center rounded-md border border-line p-0.5">
                {(["hosted", "shared"] as const).map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    aria-pressed={state.quick === quick}
                    onClick={() => setState({ ...state, quick: state.quick === quick ? null : quick })}
                    className={cn(
                      "h-full rounded px-3 text-sm capitalize transition-colors",
                      state.quick === quick
                        ? "bg-brand-soft font-medium text-brand-text"
                        : "text-secondary hover:bg-muted hover:text-title",
                    )}
                  >
                    {quick}
                  </button>
                ))}
              </div>
              <FiltersPopover state={state} onChange={setState} />

              <div className="ml-auto flex items-center gap-2">
                <Input
                  leftIcon={<Search className="h-4 w-4" />}
                  placeholder="Search meetings"
                  aria-label="Search meetings by title or keyword"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  wrapperClassName="w-[180px] sm:w-[240px]"
                  rightSlot={
                    searchText ? (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearchText("")}
                        className="text-text-muted hover:text-title"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null
                  }
                />
                <Menu>
                  <MenuTrigger
                    aria-label="Sort meetings"
                    className="flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm text-secondary hover:bg-muted"
                  >
                    <ArrowDownUp className="h-4 w-4" />
                    <span className="hidden sm:inline">{state.sort === "recent" ? "Newest" : "Oldest"}</span>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuCheckItem checked={state.sort === "recent"} onSelect={() => setState({ ...state, sort: "recent" })}>
                      Newest first
                    </MenuCheckItem>
                    <MenuCheckItem checked={state.sort === "oldest"} onSelect={() => setState({ ...state, sort: "oldest" })}>
                      Oldest first
                    </MenuCheckItem>
                  </MenuContent>
                </Menu>
              </div>
            </div>
            <FilterChips state={state} onChange={setState} />
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto">
            {isFetching && !isLoading && !isFetchingNextPage && (
              <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-brand" />
            )}
            {isLoading ? (
              <ListSkeleton />
            ) : isError ? (
              <EmptyState
                title="Couldn't load meetings"
                description="Check that the backend is running, then try again."
                action={<Button onClick={() => refetch()}>Try again</Button>}
              />
            ) : meetings.length === 0 ? (
              filtersApplied || state.channel !== "mine" ? (
                <EmptyState
                  illustration={<StackedCardsIllustration />}
                  title="No meetings match your filters"
                  description="Try a different search, or clear the filters to see all meetings."
                  action={
                    <Button
                      onClick={() => {
                        setSearchText("");
                        setState({ ...clearedFilters(state), q: "", quick: null });
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  illustration={<StackedCardsIllustration />}
                  title="Looks like you haven't recorded a meeting yet"
                  description="Once you record your first meeting with Fireflies, it'll show up right here."
                  action={
                    <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openCreateMeeting("upload")}>
                      Capture
                    </Button>
                  }
                />
              )
            ) : (
              <>
                <p className="px-4 pb-1 pt-3 text-xs text-text-muted sm:px-6">
                  {total} meeting{total === 1 ? "" : "s"}
                </p>
                {groups.map((group) => {
                  const ids = group.items.map((m) => m.id);
                  const allSelected = ids.every((id) => selected.has(id));
                  return (
                    <section key={group.key} aria-label={group.label}>
                      <div className="sticky top-0 z-[1] flex items-center gap-3 border-b border-line bg-subtle px-4 py-2 sm:px-6">
                        <input
                          type="checkbox"
                          aria-label={`Select all meetings from ${group.label}`}
                          checked={allSelected}
                          onChange={(event) => toggleSelected(ids, event.target.checked)}
                          className="h-4 w-4 cursor-pointer accent-[var(--brand)]"
                        />
                        <h2 className="font-sans text-13 font-medium text-secondary">{group.label}</h2>
                      </div>
                      {group.items.map((meeting) => (
                        <MeetingRow
                          key={meeting.id}
                          meeting={meeting}
                          selected={selected.has(meeting.id)}
                          selectionMode={selected.size > 0}
                          onSelect={(value) => toggleSelected([meeting.id], value)}
                          onDetails={() => setDetails(meeting)}
                          onRename={() => setRenaming(meeting)}
                          onDelete={() => setDeleting(meeting)}
                        />
                      ))}
                    </section>
                  );
                })}
                <div ref={sentinel} className="flex justify-center py-6">
                  {isFetchingNextPage && <Spinner className="text-text-muted" />}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 animate-scale-in items-center gap-3 rounded-xl border border-line bg-elevated px-4 py-2.5 shadow-xl">
          <span className="text-sm font-medium text-title">{selected.size} selected</span>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-secondary hover:text-title">
            Clear
          </button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setBulkConfirm(true)}>
            Delete
          </Button>
        </div>
      )}

      <MeetingDetailsSheet meeting={details} onOpenChange={(open) => !open && setDetails(null)} />
      {renaming && (
        <RenameMeetingDialog meeting={renaming} open onOpenChange={(open) => !open && setRenaming(null)} />
      )}
      {deleting && (
        <DeleteMeetingDialog meeting={deleting} open onOpenChange={(open) => !open && setDeleting(null)} />
      )}
      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        title={`Delete ${selected.size} meeting${selected.size === 1 ? "" : "s"}?`}
        description="The selected meetings and their transcripts, notes and action items will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        loading={bulkDeleting}
        onConfirm={bulkDelete}
      />
    </PageFrame>
  );
}
