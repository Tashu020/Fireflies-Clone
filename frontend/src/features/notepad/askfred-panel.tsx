"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useMe } from "@/features/workspace/api";
import { usePlayer } from "@/features/player/player-context";
import { api, ApiError } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

interface Citation {
  segment_id: number;
  start_ms: number;
  speaker_name: string;
  text: string;
}

interface AskResponse {
  answer: string;
  bullets: string[];
  citations: Citation[];
}

interface Message {
  id: number;
  question: string;
  response?: AskResponse;
  error?: string;
}

/** AskFred: questions about this meeting, answered from its notes and transcript. */
export function AskFredPanel({ meetingId, keywords }: { meetingId: string; keywords: string[] }) {
  const { data: me } = useMe();
  const player = usePlayer();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const ask = useMutation({
    mutationFn: (question: string) => api.post<AskResponse>(`/meetings/${meetingId}/ask`, { question }),
  });

  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const suggestions = [
    "What were the key decisions?",
    keywords[0] ? `What was said about ${keywords[0].toLowerCase()}?` : "Summarize the meeting",
    "What are the action items?",
  ];

  const send = (question: string) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    const id = Date.now();
    setMessages((list) => [...list, { id, question: text }]);
    setDraft("");
    ask.mutate(text, {
      onSuccess: (response) =>
        setMessages((list) => list.map((m) => (m.id === id ? { ...m, response } : m))),
      onError: (error) =>
        setMessages((list) =>
          list.map((m) =>
            m.id === id
              ? { ...m, error: error instanceof ApiError ? error.message : "AskFred couldn't answer that." }
              : m,
          ),
        ),
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex flex-col">
            <Sparkles className="mb-3 h-7 w-7 text-[#32d583]" />
            <p className="font-display text-lg text-title">
              Hi {me?.name.split(" ")[0] ?? "there"}!
              <br />
              Ask anything about this meeting
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-lg bg-subtle px-3 py-2.5 text-left text-sm text-body hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-5">
            {messages.map((message) => (
              <li key={message.id} className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-xl rounded-br-sm bg-brand px-3 py-2 text-sm text-on-brand">
                    {message.question}
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-text">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm text-body">
                    {message.error ? (
                      <p className="text-danger">{message.error}</p>
                    ) : !message.response ? (
                      <p className="flex items-center gap-2 text-text-muted">
                        <Spinner className="h-4 w-4" /> AskFred is thinking
                      </p>
                    ) : (
                      <>
                        <p>{message.response.answer}</p>
                        {message.response.bullets.length > 0 && (
                          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                            {message.response.bullets.map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                        {message.response.citations.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-2">
                            {message.response.citations.map((citation) => (
                              <li key={citation.segment_id}>
                                <button
                                  type="button"
                                  onClick={() => player.seek(citation.start_ms, { play: true })}
                                  className="flex w-full gap-2 rounded-md border border-line px-2.5 py-2 text-left text-13 hover:bg-subtle"
                                >
                                  <span className="shrink-0 font-medium text-timestamp">
                                    {formatTimestamp(citation.start_ms)}
                                  </span>
                                  <span className="text-secondary">
                                    <span className="font-medium text-body">{citation.speaker_name}: </span>
                                    {citation.text}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-lg border border-line bg-surface p-2 focus-within:border-brand focus-within:shadow-focus">
          {me && <Avatar name={me.name} color={me.avatar_color} size={24} square />}
          <textarea
            value={draft}
            rows={2}
            maxLength={500}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask anything about this meeting"
            aria-label="Ask AskFred a question"
            className="min-h-[40px] flex-1 resize-none bg-transparent text-sm text-title outline-none placeholder:text-placeholder focus-visible:shadow-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || ask.isPending}
            className="flex h-8 w-8 items-center justify-center rounded bg-brand text-on-brand hover:bg-brand-hover disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-2xs text-text-muted">
          Answers are drawn from this meeting&apos;s notes and transcript.
        </p>
      </form>
    </div>
  );
}
