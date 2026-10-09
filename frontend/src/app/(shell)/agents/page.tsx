import type { Metadata } from "next";

import { PlaceholderPage } from "../placeholders";

export const metadata: Metadata = { title: "Voice Agents" };

export default function Page() {
  return <PlaceholderPage which="agents" />;
}
