// Mirrors the backend response/request schemas (backend/app/schemas). Times inside a recording are
// milliseconds; calendar dates are ISO-8601 UTC strings.

export type MeetingSource =
  | "notetaker"
  | "chrome_extension"
  | "desktop"
  | "mobile"
  | "upload"
  | "paste"
  | "form";

export type DurationBucket = "lt15" | "15to30" | "30to60" | "60to90" | "gt90";
export type Channel = "all" | "mine" | "uploads";
export type QuickFilter = "hosted" | "shared";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Person {
  id: number;
  name: string;
  email: string | null;
  avatar_color: string;
}

export interface User extends Person {
  user_id: number;
}

export interface Participant extends Person {
  role: "host" | "attendee";
  attended: boolean;
}

export interface Speaker {
  id: number;
  name: string;
  color_index: number;
  person_id: number | null;
}

export interface ChapterPoint {
  id: number;
  text: string;
  start_ms: number | null;
  children: ChapterPoint[];
}

export interface Chapter {
  id: number;
  seq: number;
  title: string;
  intro: string;
  start_ms: number;
  end_ms: number;
  points: ChapterPoint[];
}

export interface Summary {
  overview: string;
  gist: string;
  keywords: string[];
  generator: "seed" | "heuristic" | "llm";
  generated_at: string;
}

export interface ActionItem {
  id: number;
  meeting_id: string;
  text: string;
  assignee: Person | null;
  start_ms: number | null;
  is_completed: boolean;
  completed_at: string | null;
  source: "ai" | "user";
  created_at: string;
  updated_at: string;
}

export interface MeetingListItem {
  id: string;
  title: string;
  started_at: string;
  duration_sec: number;
  source: MeetingSource;
  status: string;
  language: string;
  host: Person;
  is_host: boolean;
  participants: Participant[];
  keywords: string[];
  gist: string | null;
}

export interface MeetingDetail extends MeetingListItem {
  privacy: string;
  media_url: string | null;
  media_type: string | null;
  summary_rating: number | null;
  created_at: string;
  updated_at: string;
  speakers: Speaker[];
  summary: Summary | null;
  chapters: Chapter[];
  action_items: ActionItem[];
  segment_count: number;
}

export interface Segment {
  id: number;
  seq: number;
  speaker_id: number;
  start_ms: number;
  end_ms: number;
  text: string;
  sentiment: Sentiment | null;
  is_question: boolean;
}

export interface Transcript {
  meeting_id: string;
  speakers: Speaker[];
  segments: Segment[];
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface TaskItem extends ActionItem {
  meeting: { id: string; title: string; started_at: string };
}

export interface SearchHit {
  segment_id: number;
  start_ms: number;
  speaker_name: string;
  /** Matched terms are wrapped in \u0002 ... \u0003 markers. */
  snippet: string;
}

export interface SearchResult {
  meeting: { id: string; title: string; started_at: string };
  duration_sec: number;
  title_match: boolean;
  hit_count: number;
  hits: SearchHit[];
}

export interface SpeakerStat {
  speaker_id: number;
  name: string;
  color_index: number;
  talk_ms: number;
  talk_pct: number;
  word_count: number;
  wpm: number;
}

export type AiFilter = "questions" | "tasks" | "dates" | "metrics";

export interface Insights {
  filters: Record<AiFilter, number[]>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    positive_ids: number[];
    neutral_ids: number[];
    negative_ids: number[];
  };
  speakers: SpeakerStat[];
  topics: { name: string; count: number; segment_ids: number[] }[];
}

export interface Topic {
  id: number;
  name: string;
  meeting_count: number;
}

export interface ParticipantInput {
  name: string;
  email?: string | null;
}

export interface MeetingCreateInput {
  title: string;
  started_at?: string | null;
  duration_sec?: number | null;
  participants?: ParticipantInput[];
  transcript_text?: string | null;
  transcript_format?: "auto" | "txt" | "vtt" | "srt" | "json";
}

export interface MeetingUpdateInput {
  title?: string;
  started_at?: string;
  participants?: ParticipantInput[];
  summary_rating?: number | null;
}

export interface ActionItemInput {
  text?: string;
  assignee_person_id?: number | null;
  start_ms?: number | null;
  is_completed?: boolean;
}

export interface MeetingFilters {
  q?: string;
  channel?: Channel;
  quick?: QuickFilter;
  host?: number[];
  participant?: number[];
  source?: MeetingSource[];
  duration?: DurationBucket[];
  topic?: number[];
  date_from?: string;
  date_to?: string;
  sort?: "recent" | "oldest";
}
