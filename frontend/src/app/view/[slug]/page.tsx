import type { Metadata } from "next";
import { Suspense } from "react";

import { NotepadPage } from "@/features/notepad/notepad-page";
import { meetingIdFromSlug } from "@/lib/routes";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const slug = decodeURIComponent(params.slug);
  const title = slug.slice(0, slug.lastIndexOf("::")).replace(/-/g, " ") || "Meeting";
  return { title };
}

export default function Page({ params }: { params: { slug: string } }) {
  return (
    <Suspense>
      <NotepadPage meetingId={meetingIdFromSlug(params.slug)} />
    </Suspense>
  );
}
