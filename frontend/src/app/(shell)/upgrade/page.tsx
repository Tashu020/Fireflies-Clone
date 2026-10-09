import type { Metadata } from "next";

import { PlaceholderPage } from "../placeholders";

export const metadata: Metadata = { title: "Upgrade" };

export default function Page() {
  return <PlaceholderPage which="upgrade" />;
}
