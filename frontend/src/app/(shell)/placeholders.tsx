"use client";

import { AudioLines, Bot, ChartColumn, Layers, Sparkles, Zap, type LucideIcon } from "lucide-react";

import { ComingSoonPage } from "@/components/layout/coming-soon";
import { PageFrame } from "@/components/layout/page-frame";

export type PlaceholderKey = "skills" | "analytics" | "agents" | "integrations" | "upgrade" | "askfred";

const PLACEHOLDERS: Record<PlaceholderKey, { title: string; icon: LucideIcon; description: string }> = {
  askfred: {
    title: "AskFred",
    icon: Bot,
    description:
      "Ask questions across all of your meetings and get answers with sources. Open a meeting to use AskFred on a single conversation.",
  },
  skills: {
    title: "AI Skills",
    icon: Sparkles,
    description: "Run AI apps on your meetings to extract objections, scorecards, follow-up emails and more.",
  },
  analytics: {
    title: "Analytics",
    icon: ChartColumn,
    description: "Conversation intelligence for your team: talk time, topics, sentiment and trends across meetings.",
  },
  agents: {
    title: "Voice Agents",
    icon: AudioLines,
    description: "AI voice agents that run interviews, check-ins and surveys on your behalf.",
  },
  integrations: {
    title: "Integrations",
    icon: Layers,
    description: "Connect Zoom, Google Meet, Microsoft Teams, your calendar, Slack and your CRM.",
  },
  upgrade: {
    title: "Upgrade",
    icon: Zap,
    description: "Unlock unlimited transcription, video recording and advanced AI features.",
  },
};

export function PlaceholderPage({ which }: { which: PlaceholderKey }) {
  const page = PLACEHOLDERS[which];
  return (
    <PageFrame title={page.title}>
      <ComingSoonPage icon={page.icon} title={page.title} description={page.description} />
    </PageFrame>
  );
}
