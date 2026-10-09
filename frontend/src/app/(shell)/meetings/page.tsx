import type { Metadata } from "next";
import { Suspense } from "react";

import { MeetingsPage } from "@/features/meetings/components/meetings-page";

export const metadata: Metadata = { title: "Meetings" };

export default function Page() {
  // useSearchParams() requires a Suspense boundary for static rendering.
  return (
    <Suspense>
      <MeetingsPage />
    </Suspense>
  );
}
