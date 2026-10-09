import type { Metadata } from "next";

import { PlaceholderPage } from "../placeholders";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return <PlaceholderPage which="analytics" />;
}
