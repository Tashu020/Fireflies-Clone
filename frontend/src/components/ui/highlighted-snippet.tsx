const START = "\u0002";
const END = "\u0003";

/**
 * Renders a backend search snippet where matches are wrapped in \u0002 ... \u0003 markers.
 * Text is rendered as React text nodes (never as HTML), so transcript content can't inject markup.
 */
export function HighlightedSnippet({ snippet }: { snippet: string }) {
  const parts: { text: string; hit: boolean }[] = [];
  let rest = snippet;
  while (rest.length > 0) {
    const start = rest.indexOf(START);
    if (start === -1) {
      parts.push({ text: rest, hit: false });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start), hit: false });
    const end = rest.indexOf(END, start + 1);
    const stop = end === -1 ? rest.length : end;
    parts.push({ text: rest.slice(start + 1, stop), hit: true });
    rest = end === -1 ? "" : rest.slice(end + 1);
  }
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <mark key={index} className="rounded-sm bg-match-bg px-0.5 text-match-text">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
