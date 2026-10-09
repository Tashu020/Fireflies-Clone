import type { Metadata } from "next";

import { PlaceholderPage } from "../placeholders";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return <PlaceholderPage which="integrations" />;
}
