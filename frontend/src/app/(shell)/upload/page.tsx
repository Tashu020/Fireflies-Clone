import type { Metadata } from "next";

import { UploadsPage } from "@/features/meetings/components/uploads-page";

export const metadata: Metadata = { title: "Uploads" };

export default function Page() {
  return <UploadsPage />;
}
