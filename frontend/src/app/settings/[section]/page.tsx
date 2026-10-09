import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SettingsPage, type SettingsSection } from "@/features/settings/settings-page";

const SECTIONS: SettingsSection[] = [
  "appearance",
  "recording",
  "notifications",
  "email-assistant",
  "ai",
  "live-assist",
  "knowledge-base",
  "api",
  "cookies",
  "account",
];

export const metadata: Metadata = { title: "Settings" };

export default function Page({ params }: { params: { section: string } }) {
  const section = SECTIONS.find((s) => s === params.section);
  if (!section) notFound();
  return <SettingsPage section={section} />;
}
