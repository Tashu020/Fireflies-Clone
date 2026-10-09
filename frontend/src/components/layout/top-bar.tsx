"use client";

import { Menu as MenuIcon, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CaptureButton } from "@/components/layout/capture-button";
import { NavDrawer } from "@/components/layout/nav-drawer";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { useUI } from "@/components/providers/ui-provider";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/controls";

/** Fireflies top bar: page title, global search, Upgrade, notifications, Capture, avatar. */
export function TopBar({ title }: { title: ReactNode }) {
  const { openSearch, openComingSoon } = useUI();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setDrawerOpen(true)}
        className="rounded p-1.5 text-secondary hover:bg-muted md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <h1 className="shrink-0 font-display text-[15px] font-medium text-title">{title}</h1>

      <button
        type="button"
        onClick={openSearch}
        className="ml-2 hidden h-9 w-full max-w-[400px] items-center gap-2 rounded-md border border-line bg-subtle px-3 text-left text-sm text-placeholder transition-colors hover:border-line-strong sm:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate">Search by title or keyword</span>
        <Kbd>Ctrl + K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Search"
          onClick={openSearch}
          className="rounded p-1.5 text-secondary hover:bg-muted sm:hidden"
        >
          <Search className="h-5 w-5" />
        </button>
        <Button
          variant="upgrade"
          className="hidden lg:inline-flex"
          onClick={() => openComingSoon("Paid plans")}
        >
          Upgrade
        </Button>
        <NotificationsMenu />
        <CaptureButton />
        <ProfileMenu />
      </div>
      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </header>
  );
}
