/** Fireflies meeting URLs look like /view/Weekly-Product-Sync::AbC123xYz0 — readable + stable id. */
export function meetingHref(id: string, title: string, seconds?: number): string {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 80) || "meeting";
  const query = seconds !== undefined ? `?t=${Math.floor(seconds)}` : "";
  return `/view/${encodeURIComponent(slug)}::${id}${query}`;
}

/** Extracts the meeting id from a /view/[slug] segment (the part after "::"). */
export function meetingIdFromSlug(slug: string): string {
  const decoded = decodeURIComponent(slug);
  const index = decoded.lastIndexOf("::");
  return index >= 0 ? decoded.slice(index + 2) : decoded;
}
