import type { Metadata } from "next";

import { PlaceholderPage } from "../placeholders";

export const metadata: Metadata = { title: "AI Skills" };

export default function Page() {
  return <PlaceholderPage which="skills" />;
}
