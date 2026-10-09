"use client";

import { Clock, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Menu, MenuCheckItem, MenuContent, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useCreateActionItem, useDeleteActionItem, useUpdateActionItem } from "@/features/action-items/api";
import { SectionHeading, groupByAssignee } from "@/features/notepad/summary-sections";
import { TimestampLink } from "@/features/notepad/timestamp-link";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { ActionItem, Participant } from "@/lib/types";

function fail(error: unknown, fallback: string) {
  toast.error(error instanceof ApiError ? error.message : fallback);
}

function AssigneeMenu({
  participants,
  value,
  onChange,
  trigger,
}: {
  participants: Participant[];
  value: number | null;
  onChange: (personId: number | null) => void;
  trigger: ReactNode;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent className="max-h-72 overflow-y-auto">
        <MenuLabel>Assign to</MenuLabel>
        {participants.map((person) => (
          <MenuCheckItem
            key={person.id}
            checked={value === person.id}
            onSelect={() => onChange(person.id)}
            icon={<Avatar name={person.name} color={person.avatar_color} size={18} />}
          >
            {person.name}
          </MenuCheckItem>
        ))}
        <MenuSeparator />
        <MenuCheckItem checked={value === null} onSelect={() => onChange(null)} icon={<UserRound className="h-4 w-4" />}>
          Unassigned
        </MenuCheckItem>
      </MenuContent>
    </Menu>
  );
}

function ActionItemRow({
  item,
  meetingId,
  participants,
}: {
  item: ActionItem;
  meetingId: string;
  participants: Participant[];
}) {
  const update = useUpdateActionItem(meetingId);
  const remove = useDeleteActionItem(meetingId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  useEffect(() => {
    if (!editing) setText(item.text);
  }, [item.text, editing]);

  const save = () => {
    const next = text.trim();
    setEditing(false);
    if (!next || next === item.text) return setText(item.text);
    update.mutate({ id: item.id, input: { text: next } }, { onError: (e) => fail(e, "Couldn't update the action item") });
  };

  return (
    <li className="group -mx-2 flex items-start gap-2.5 rounded-md px-2 py-1 hover:bg-subtle">
      <Checkbox
        className="mt-[5px]"
        checked={item.is_completed}
        label={item.is_completed ? `Mark "${item.text}" as not done` : `Mark "${item.text}" as done`}
        onChange={(checked) =>
          update.mutate(
            { id: item.id, input: { is_completed: checked } },
            {
              onSuccess: () => checked && toast.success("Action item completed"),
              onError: (e) => fail(e, "Couldn't update the action item"),
            },
          )
        }
      />
      <div className="min-w-0 flex-1 text-15 leading-7">
        {editing ? (
          <input
            autoFocus
            value={text}
            maxLength={1000}
            aria-label="Edit action item"
            onChange={(event) => setText(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") {
                setText(item.text);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-brand bg-surface px-2 py-0.5 text-15 text-title shadow-focus outline-none"
          />
        ) : (
          <span className={cn(item.is_completed ? "text-text-muted line-through" : "text-body")}>
            {item.text}
            <TimestampLink ms={item.start_ms} />
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <AssigneeMenu
          participants={participants}
          value={item.assignee?.id ?? null}
          onChange={(personId) =>
            update.mutate(
              { id: item.id, input: { assignee_person_id: personId } },
              { onSuccess: () => toast.success("Assignee updated"), onError: (e) => fail(e, "Couldn't reassign") },
            )
          }
          trigger={
            <button type="button" aria-label="Change assignee" className="rounded p-1.5 text-text-muted hover:bg-muted hover:text-title">
              <UserRound className="h-4 w-4" />
            </button>
          }
        />
        <IconButton label="Edit" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label="Delete"
          size="sm"
          onClick={() =>
            remove.mutate(item.id, {
              onSuccess: () => toast.success("Action item deleted"),
              onError: (e) => fail(e, "Couldn't delete the action item"),
            })
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </li>
  );
}

export interface ActionItemsHandle {
  /** Opens the "add" form, optionally pinned to a moment of the recording. */
  startAdding: (startMs?: number) => void;
}

export const ActionItemsSection = forwardRef<
  ActionItemsHandle,
  { meetingId: string; items: ActionItem[]; participants: Participant[]; durationMs: number }
>(function ActionItemsSection({ meetingId, items, participants, durationMs }, ref) {
  const create = useCreateActionItem(meetingId);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState<number | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    startAdding: (ms?: number) => {
      setAdding(true);
      setStartMs(ms !== undefined ? Math.min(Math.round(ms), durationMs) : null);
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => inputRef.current?.focus(), 250);
    },
  }));

  const reset = () => {
    setAdding(false);
    setText("");
    setAssignee(null);
    setStartMs(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    create.mutate(
      { text: text.trim(), assignee_person_id: assignee, start_ms: startMs },
      {
        onSuccess: () => {
          toast.success("Action item added");
          reset();
        },
        onError: (e) => fail(e, "Couldn't add the action item"),
      },
    );
  };

  const groups = groupByAssignee(items);
  const assigneeName = participants.find((p) => p.id === assignee)?.name;

  return (
    <section ref={sectionRef} aria-labelledby="notes-action-items" className="scroll-mt-16">
      <div className="flex items-center justify-between">
        <SectionHeading id="notes-action-items">Action items</SectionHeading>
        {!adding && (
          <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add
          </Button>
        )}
      </div>

      {items.length === 0 && !adding && (
        <p className="text-15 text-text-muted">No action items yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {groups.map(([name, groupItems]) => (
          <div key={name}>
            <h5 className="mb-0.5 font-sans text-15 font-semibold text-title">{name}</h5>
            <ul className="flex flex-col">
              {groupItems.map((item) => (
                <ActionItemRow key={item.id} item={item} meetingId={meetingId} participants={participants} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {adding && (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-subtle p-3">
          <input
            ref={inputRef}
            autoFocus
            value={text}
            maxLength={1000}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && reset()}
            placeholder="What needs to be done?"
            aria-label="New action item"
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-title outline-none placeholder:text-placeholder focus:border-brand focus:shadow-focus"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeMenu
              participants={participants}
              value={assignee}
              onChange={setAssignee}
              trigger={
                <button type="button" className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-13 text-body hover:bg-muted">
                  <UserRound className="h-3.5 w-3.5" /> {assigneeName ?? "Assign"}
                </button>
              }
            />
            {startMs !== null ? (
              <span className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-13 text-body">
                <Clock className="h-3.5 w-3.5" /> {formatTimestamp(startMs)}
                <button type="button" aria-label="Remove timestamp" onClick={() => setStartMs(null)} className="text-text-muted hover:text-title">
                  ×
                </button>
              </span>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button onClick={reset}>Cancel</Button>
              <Button type="submit" variant="primary" loading={create.isPending} disabled={!text.trim()}>
                Add action item
              </Button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
});
