"use client";

import { AudioLines, Building2, Hash, Plus, Search, Upload } from "lucide-react";
import type { ReactNode } from "react";

import { useUI } from "@/components/providers/ui-provider";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import type { Channel } from "@/lib/types";

function ChannelItem({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-[15px] transition-colors",
        active
          ? "bg-brand-soft font-medium text-brand-text"
          : "text-secondary hover:bg-muted hover:text-title",
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {badge}
    </button>
  );
}

/** Fireflies' channel column on the Meetings page. */
export function ChannelSidebar({
  channel,
  onChange,
}: {
  channel: Channel;
  onChange: (channel: Channel) => void;
}) {
  const { openComingSoon } = useUI();
  return (
    <aside className="hidden w-[272px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="p-3">
        <Input
          leftIcon={<Search className="h-4 w-4" />}
          placeholder="Search channels"
          aria-label="Search channels"
          onFocus={() => openComingSoon("Channels")}
          readOnly
        />
      </div>
      <nav aria-label="Channels" className="flex flex-col gap-1 border-b border-line px-3 pb-3">
        <ChannelItem
          icon={<Hash className="h-[18px] w-[18px]" />}
          label="My Meetings"
          active={channel === "mine"}
          onClick={() => onChange("mine")}
        />
        <ChannelItem
          icon={<Building2 className="h-[18px] w-[18px]" />}
          label="All Meetings"
          active={channel === "all"}
          onClick={() => onChange("all")}
        />
        <ChannelItem
          icon={<AudioLines className="h-[18px] w-[18px]" />}
          label="Voice Agent Meetings"
          onClick={() => openComingSoon("Voice Agent meetings")}
        />
        <ChannelItem
          icon={<Upload className="h-[18px] w-[18px]" />}
          label="Uploads"
          active={channel === "uploads"}
          onClick={() => onChange("uploads")}
          badge={<Badge tone="success">NEW</Badge>}
        />
      </nav>
      <div className="flex flex-col px-3 py-4">
        <p className="px-3 text-[15px] text-secondary">All channels</p>
        <div className="flex flex-col items-center px-4 py-6 text-center">
          <Hash className="mb-3 h-6 w-6 text-[#ee46bc]" />
          <p className="text-[15px] text-body">Create channels to organize your conversations</p>
          <Button
            className="mt-4"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => openComingSoon("Channels")}
          >
            Channel
          </Button>
        </div>
      </div>
    </aside>
  );
}
