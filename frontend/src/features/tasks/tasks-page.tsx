"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageFrame } from "@/components/layout/page-frame";
import { useUI } from "@/components/providers/ui-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, SegmentedControl, Skeleton } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty-state";
import { useDeleteTask, useTasks, useUpdateTask } from "@/features/action-items/api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatLongDate, formatTimestamp } from "@/lib/format";
import { meetingHref } from "@/lib/routes";
import type { TaskItem } from "@/lib/types";

type Scope = "mine" | "all";
type Status = "open" | "done" | "all";

const APP_TILES = [
  { label: "Asana", color: "#F06A6A" },
  { label: "Monday", color: "#FFCB00" },
  { label: "Trello", color: "#0079BF" },
  { label: "ClickUp", color: "#7B68EE" },
];

function TaskRow({ task }: { task: TaskItem }) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const fail = (error: unknown) =>
    toast.error(error instanceof ApiError ? error.message : "Couldn't update the task");

  return (
    <li className="group flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-subtle">
      <Checkbox
        className="mt-1"
        checked={task.is_completed}
        label={task.is_completed ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`}
        onChange={(checked) =>
          update.mutate(
            { id: task.id, input: { is_completed: checked } },
            { onSuccess: () => checked && toast.success("Task completed"), onError: fail },
          )
        }
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-15", task.is_completed ? "text-text-muted line-through" : "text-body")}>
          {task.text}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-13 text-text-muted">
          {task.assignee ? (
            <span className="flex items-center gap-1.5">
              <Avatar name={task.assignee.name} color={task.assignee.avatar_color} size={18} />
              {task.assignee.name}
            </span>
          ) : (
            <span>Unassigned</span>
          )}
          {task.start_ms !== null && (
            <Link
              href={meetingHref(task.meeting.id, task.meeting.title, task.start_ms / 1000)}
              className="text-timestamp hover:underline"
            >
              {formatTimestamp(task.start_ms)}
            </Link>
          )}
          {task.source === "ai" && <span>Captured by AI</span>}
        </div>
      </div>
      <IconButton
        label="Delete task"
        className="opacity-0 group-hover:opacity-100"
        onClick={() =>
          remove.mutate(
            { id: task.id, meetingId: task.meeting.id },
            { onSuccess: () => toast.success("Task deleted"), onError: fail },
          )
        }
      >
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </li>
  );
}

export function TasksPage() {
  const { openComingSoon, openCreateMeeting } = useUI();
  const [scope, setScope] = useState<Scope>("mine");
  const [status, setStatus] = useState<Status>("open");
  const { data, isLoading, isError, refetch } = useTasks(scope, status);

  const groups = useMemo(() => {
    const map = new Map<string, { meeting: TaskItem["meeting"]; tasks: TaskItem[] }>();
    for (const task of data?.items ?? []) {
      const group = map.get(task.meeting.id) ?? { meeting: task.meeting, tasks: [] };
      group.tasks.push(task);
      map.set(task.meeting.id, group);
    }
    return [...map.values()];
  }, [data]);

  return (
    <PageFrame title="Tasks">
      <div className="mx-auto flex max-w-[920px] flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<Scope>
              ariaLabel="Whose tasks"
              value={scope}
              onChange={setScope}
              options={[
                { value: "mine", label: "My Tasks" },
                { value: "all", label: "All Tasks" },
              ]}
            />
            <SegmentedControl<Status>
              ariaLabel="Task status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "open", label: "Open" },
                { value: "done", label: "Completed" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          <Button variant="ghost" onClick={() => openComingSoon("Feedback")}>
            Share Feedback
          </Button>
        </div>

        <div className="flex items-center gap-4 rounded-lg bg-subtle px-4 py-3">
          <div className="flex shrink-0 overflow-hidden rounded-md border border-line bg-surface">
            {APP_TILES.map((tile) => (
              <span key={tile.label} title={tile.label} className="flex h-8 w-8 items-center justify-center border-r border-line last:border-r-0">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: tile.color }} />
              </span>
            ))}
          </div>
          <p className="flex-1 text-sm text-body">Automatically send all your tasks to your work apps.</p>
          <button type="button" onClick={() => openComingSoon("Task integrations")} className="text-sm font-medium text-brand-text hover:underline">
            Connect
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState title="Couldn't load tasks" action={<Button onClick={() => refetch()}>Try again</Button>} />
        ) : groups.length === 0 ? (
          <EmptyState
            illustration={<ListChecks className="h-10 w-10 text-placeholder" strokeWidth={1.5} />}
            title={status === "done" ? "No completed tasks yet" : "All your meeting tasks in one place"}
            description="Manage, assign and update all your meeting tasks here."
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openCreateMeeting("upload")}>
                New
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map(({ meeting, tasks }) => (
              <section key={meeting.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                <header className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-2.5">
                  <Link href={meetingHref(meeting.id, meeting.title)} className="truncate text-sm font-medium text-title hover:text-brand-text">
                    {meeting.title}
                  </Link>
                  <span className="shrink-0 text-xs text-text-muted">{formatLongDate(meeting.started_at)}</span>
                </header>
                <ul>
                  {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
