import type { MeetingFilters } from "@/lib/types";

/** Central list of TanStack Query keys, so invalidation after mutations stays consistent. */
export const queryKeys = {
  meetings: ["meetings"] as const,
  meetingList: (filters: MeetingFilters) => ["meetings", "list", filters] as const,
  meeting: (id: string) => ["meetings", "detail", id] as const,
  transcript: (id: string) => ["meetings", "transcript", id] as const,
  insights: (id: string) => ["meetings", "insights", id] as const,
  tasks: ["tasks"] as const,
  taskList: (scope: string, status: string) => ["tasks", scope, status] as const,
  me: ["me"] as const,
  users: ["users"] as const,
  people: (q: string) => ["people", q] as const,
  topics: ["topics"] as const,
  search: (q: string) => ["search", q] as const,
};
