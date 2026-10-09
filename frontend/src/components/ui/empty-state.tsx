import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Three stacked placeholder cards — the Fireflies empty-list illustration. */
export function StackedCardsIllustration() {
  return (
    <div aria-hidden className="flex flex-col items-center gap-3">
      {[
        ["K", "w-[220px]"],
        ["A", "w-[260px]"],
        ["R", "w-[220px]"],
      ].map(([letter, width]) => (
        <div
          key={letter}
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 shadow-sm",
            width,
          )}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-2xs text-text-muted">
            {letter}
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <span className="h-1.5 w-3/5 rounded bg-muted" />
            <span className="h-1.5 w-2/5 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
}: {
  illustration?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      {illustration && <div className="mb-8">{illustration}</div>}
      <h3 className="max-w-sm text-lg font-medium text-title">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
