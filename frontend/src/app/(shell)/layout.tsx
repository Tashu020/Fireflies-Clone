import type { ReactNode } from "react";

import { NavRail } from "@/components/layout/nav-rail";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
