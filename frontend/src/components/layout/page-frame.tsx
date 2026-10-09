import type { ReactNode } from "react";

import { TopBar } from "@/components/layout/top-bar";
import { cn } from "@/lib/cn";

/** Top bar + scrollable page body used by every page inside the app shell. */
export function PageFrame({
  title,
  children,
  scroll = true,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  /** Pages with their own scroll areas (e.g. Meetings) pass false. */
  scroll?: boolean;
  className?: string;
}) {
  return (
    <>
      <TopBar title={title} />
      <main
        className={cn(
          "min-h-0 flex-1 bg-page",
          scroll ? "overflow-y-auto" : "overflow-hidden",
          className,
        )}
      >
        {children}
      </main>
    </>
  );
}
