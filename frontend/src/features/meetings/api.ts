import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, buildQuery } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  Insights,
  MeetingCreateInput,
  MeetingDetail,
  MeetingFilters,
  MeetingListItem,
  MeetingUpdateInput,
  Page,
  Segment,
  Speaker,
  Transcript,
} from "@/lib/types";

const PAGE_SIZE = 25;

export function useMeetingsInfinite(filters: MeetingFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.meetingList(filters),
    queryFn: ({ pageParam }) =>
      api.get<Page<MeetingListItem>>(
        `/meetings${buildQuery({ ...filters, limit: PAGE_SIZE, offset: pageParam })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.limit : undefined,
    placeholderData: keepPreviousData,
  });
}

export function useRecentMeetings(limit = 5) {
  return useQuery({
    queryKey: [...queryKeys.meetingList({ sort: "recent" }), limit],
    queryFn: () => api.get<Page<MeetingListItem>>(`/meetings${buildQuery({ limit })}`),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: queryKeys.meeting(id),
    queryFn: () => api.get<MeetingDetail>(`/meetings/${id}`),
  });
}

export function useTranscript(id: string) {
  return useQuery({
    queryKey: queryKeys.transcript(id),
    queryFn: () => api.get<Transcript>(`/meetings/${id}/transcript`),
    staleTime: 5 * 60_000,
  });
}

export function useInsights(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.insights(id),
    queryFn: () => api.get<Insights>(`/meetings/${id}/insights`),
    enabled,
  });
}

function useInvalidateMeetings() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.meetings }),
      client.invalidateQueries({ queryKey: queryKeys.tasks }),
      client.invalidateQueries({ queryKey: queryKeys.topics }),
    ]);
}

export function useCreateMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: MeetingCreateInput) => api.post<MeetingDetail>("/meetings", input),
    onSuccess: () => invalidate(),
  });
}

export function useUploadMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (form: FormData) => api.post<MeetingDetail>("/meetings/upload", form),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMeeting(id: string) {
  const client = useQueryClient();
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: MeetingUpdateInput) => api.patch<MeetingDetail>(`/meetings/${id}`, input),
    onSuccess: (meeting) => {
      client.setQueryData(queryKeys.meeting(id), meeting);
      return invalidate();
    },
  });
}

export function useDeleteMeeting() {
  const client = useQueryClient();
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/meetings/${id}`),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: queryKeys.meeting(id) });
      client.removeQueries({ queryKey: queryKeys.transcript(id) });
      return invalidate();
    },
  });
}

export function useRegenerateSummary(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MeetingDetail>(`/meetings/${id}/summary/regenerate`),
    onSuccess: (meeting) => {
      client.setQueryData(queryKeys.meeting(id), meeting);
      void client.invalidateQueries({ queryKey: queryKeys.tasks });
      void client.invalidateQueries({ queryKey: queryKeys.insights(id) });
    },
  });
}

export function useRenameSpeaker(meetingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ speakerId, name }: { speakerId: number; name: string }) =>
      api.patch<Speaker>(`/meetings/${meetingId}/speakers/${speakerId}`, { name }),
    onSuccess: (speaker) => {
      client.setQueryData<Transcript>(queryKeys.transcript(meetingId), (old) =>
        old
          ? { ...old, speakers: old.speakers.map((s) => (s.id === speaker.id ? speaker : s)) }
          : old,
      );
      void client.invalidateQueries({ queryKey: queryKeys.meeting(meetingId) });
      void client.invalidateQueries({ queryKey: queryKeys.insights(meetingId) });
    },
  });
}

export function useUpdateSegment(meetingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ segmentId, text }: { segmentId: number; text: string }) =>
      api.patch<Segment>(`/meetings/${meetingId}/segments/${segmentId}`, { text }),
    onSuccess: (segment) => {
      client.setQueryData<Transcript>(queryKeys.transcript(meetingId), (old) =>
        old
          ? { ...old, segments: old.segments.map((s) => (s.id === segment.id ? segment : s)) }
          : old,
      );
      void client.invalidateQueries({ queryKey: queryKeys.insights(meetingId) });
    },
  });
}
