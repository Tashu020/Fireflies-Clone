"use client";

import {
  AudioLines,
  Bot,
  ChartColumn,
  House,
  Layers,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  UserPlus,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo, LogoMark } from "@/components/layout/logo";
import { useUI } from "@/components/providers/ui-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  /** Opens the Coming Soon dialog instead of navigating. */
  comingSoon?: string;
  badge?: string;
  shortcut?: string;
  iconClassName?: string;
}

const GROUPS: NavItem[][] = [
  [
    { label: "Home", href: "/", icon: House },
    {
      label: "AskFred",
      href: "/ask-fred",
      icon: Bot,
      shortcut: "Ctrl + J",
      iconClassName: "text-brand-accent",
    },
  ],
  [
    { label: "Meetings", href: "/meetings", icon: Video },
    { label: "Tasks", href: "/tasks", icon: ListChecks },
    { label: "AI Skills", href: "/skills", icon: Sparkles },
  ],
  [
    { label: "Analytics", href: "/analytics", icon: ChartColumn },
    { label: "Voice Agents", href: "/agents", icon: AudioLines },
  ],
  [{ label: "Upgrade", href: "/upgrade", icon: Zap, badge: "40% OFF" }],
];

const BOTTOM: NavItem[] = [
  { label: "Invite teammates", icon: UserPlus, comingSoon: "Team invites" },
  { label: "Integrations", href: "/integrations", icon: Layers },
  { label: "Settings", href: "/settings/appearance", icon: Settings },
];

const STORAGE_KEY = "ff-nav-expanded";

function isActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  const root = href.split("/").slice(0, 2).join("/");
  return pathname === href || pathname.startsWith(`${root}/`) || pathname === root;
}

function NavLink({
  item,
  expanded,
  active,
  onNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { openComingSoon } = useUI();
  const Icon = item.icon;
  const className = cn(
    "group flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
    active
      ? "bg-muted font-medium text-title"
      : "text-secondary hover:bg-muted hover:text-title",
  );
  const content = (
    <>
      <span className="relative flex h-5 w-5 items-center justify-center">
        <Icon className={cn("h-[18px] w-[18px]", item.iconClassName)} strokeWidth={1.8} />
        {item.badge && !expanded && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-success" />
        )}
      </span>
      {expanded && (
        <>
          <span className="flex-1 truncate text-left">{item.label}</span>
          {item.shortcut && <span className="text-2xs text-text-muted">{item.shortcut}</span>}
          {item.badge && (
            <span className="rounded bg-success-bg px-1.5 py-0.5 text-2xs font-medium text-success-text">
              {item.badge}
            </span>
          )}
        </>
      )}
    </>
  );

  const element = item.href ? (
    <Link
      href={item.href}
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      className={className}
      onClick={() => item.comingSoon && openComingSoon(item.comingSoon)}
    >
      {content}
    </button>
  );

  return expanded ? (
    element
  ) : (
    <Tooltip content={item.label} side="right">
      {element}
    </Tooltip>
  );
}

export function NavRailContent({
  expanded,
  onToggle,
  onNavigate,
}: {
  expanded: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="flex h-full flex-col border-r border-line bg-surface px-2 py-3"
    >
      <div className={cn("mb-3 flex h-9 items-center", expanded ? "justify-between px-1" : "justify-center")}>
        {expanded ? <Logo /> : <LogoMark />}
        {expanded && onToggle && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={onToggle}
            className="rounded p-1.5 text-text-muted hover:bg-muted hover:text-title"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>
      {!expanded && onToggle && (
        <Tooltip content="Expand sidebar" side="right">
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={onToggle}
            className="mb-2 flex h-9 w-full items-center justify-center rounded-md text-text-muted hover:bg-muted hover:text-title"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </Tooltip>
      )}

      <div className="flex flex-1 flex-col overflow-y-auto">
        {GROUPS.map((group, index) => (
          <div
            key={index}
            className={cn("flex flex-col gap-0.5 py-2", index > 0 && "border-t border-line")}
          >
            {group.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                expanded={expanded}
                active={isActive(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-line pt-2">
        {BOTTOM.map((item) => (
          <NavLink
            key={item.label}
            item={item}
            expanded={expanded}
            active={isActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

/** Persistent left navigation; collapsed to icons by default like Fireflies. */
export function NavRail() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  const toggle = () =>
    setExpanded((value) => {
      try {
        localStorage.setItem(STORAGE_KEY, value ? "0" : "1");
      } catch {
        // ignore
      }
      return !value;
    });

  return (
    <aside
      className={cn(
        "hidden shrink-0 transition-[width] duration-200 md:block",
        expanded ? "w-[232px]" : "w-[60px]",
      )}
    >
      <NavRailContent expanded={expanded} onToggle={toggle} />
    </aside>
  );
}
