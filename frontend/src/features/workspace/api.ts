import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, buildQuery } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Person, SearchResult, Topic, User } from "@/lib/types";

const LONG = 10 * 60_000;

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.get<User>("/me"), staleTime: LONG });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => api.get<User[]>("/users"),
    staleTime: LONG,
  });
}

export function usePeople(q: string) {
  return useQuery({
    queryKey: queryKeys.people(q),
    queryFn: () => api.get<Person[]>(`/people${buildQuery({ q, limit: 50 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useTopics() {
  return useQuery({ queryKey: queryKeys.topics, queryFn: () => api.get<Topic[]>("/topics") });
}

export function useSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () =>
      api.get<{ query: string; results: SearchResult[] }>(`/search${buildQuery({ q: query })}`),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
}
