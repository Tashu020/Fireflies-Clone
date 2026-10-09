import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQuery } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ActionItem, ActionItemInput, MeetingDetail, Page, TaskItem } from "@/lib/types";

export function useTasks(scope: "mine" | "all", status: "open" | "done" | "all") {
  return useQuery({
    queryKey: queryKeys.taskList(scope, status),
    queryFn: () =>
      api.get<Page<TaskItem>>(`/action-items${buildQuery({ scope, status, limit: 100 })}`),
  });
}

/** Applies `update` to the action items cached in a meeting detail. */
function patchMeetingItems(
  client: ReturnType<typeof useQueryClient>,
  meetingId: string,
  update: (items: ActionItem[]) => ActionItem[],
) {
  client.setQueryData<MeetingDetail>(queryKeys.meeting(meetingId), (old) =>
    old ? { ...old, action_items: update(old.action_items) } : old,
  );
}

export function useCreateActionItem(meetingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ActionItemInput & { text: string }) =>
      api.post<ActionItem>(`/meetings/${meetingId}/action-items`, input),
    onSuccess: (item) => {
      patchMeetingItems(client, meetingId, (items) => [...items, item]);
      void client.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
}

/** Optimistic: the UI updates immediately and rolls back if the request fails. */
export function useUpdateActionItem(meetingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ActionItemInput }) =>
      api.patch<ActionItem>(`/action-items/${id}`, input),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: queryKeys.meeting(meetingId) });
      const previous = client.getQueryData<MeetingDetail>(queryKeys.meeting(meetingId));
      patchMeetingItems(client, meetingId, (items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(input.text !== undefined ? { text: input.text } : {}),
                ...(input.is_completed !== undefined ? { is_completed: input.is_completed } : {}),
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(queryKeys.meeting(meetingId), context.previous);
    },
    onSuccess: (item) => {
      patchMeetingItems(client, meetingId, (items) =>
        items.map((existing) => (existing.id === item.id ? item : existing)),
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}

export function useDeleteActionItem(meetingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/action-items/${id}`),
    onSuccess: (_data, id) => {
      patchMeetingItems(client, meetingId, (items) => items.filter((item) => item.id !== id));
      void client.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
}

/** Task page variant: the meeting id comes with each task, so caches are refreshed broadly. */
export function useUpdateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ActionItemInput }) =>
      api.patch<ActionItem>(`/action-items/${id}`, input),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: queryKeys.tasks });
      const snapshots = client.getQueriesData<Page<TaskItem>>({ queryKey: queryKeys.tasks });
      client.setQueriesData<Page<TaskItem>>({ queryKey: queryKeys.tasks }, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((task) =>
                task.id === id
                  ? {
                      ...task,
                      ...(input.text !== undefined ? { text: input.text } : {}),
                      ...(input.is_completed !== undefined
                        ? { is_completed: input.is_completed }
                        : {}),
                    }
                  : task,
              ),
            }
          : old,
      );
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => client.setQueryData(key, data));
    },
    onSettled: (item) => {
      void client.invalidateQueries({ queryKey: queryKeys.tasks });
      if (item) void client.invalidateQueries({ queryKey: queryKeys.meeting(item.meeting_id) });
    },
  });
}

export function useDeleteTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; meetingId: string }) => api.delete(`/action-items/${id}`),
    onSuccess: (_data, { meetingId }) => {
      void client.invalidateQueries({ queryKey: queryKeys.tasks });
      void client.invalidateQueries({ queryKey: queryKeys.meeting(meetingId) });
    },
  });
}
