"use client";

import {
  ArrowLeft,
  Bot,
  BookOpen,
  Code,
  Cookie,
  Gift,
  IdCard,
  Mail,
  Monitor,
  Moon,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  Video,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useTheme, type ThemePreference } from "@/components/providers/theme-provider";
import { useUI } from "@/components/providers/ui-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Input, SegmentedControl } from "@/components/ui/controls";
import { useMe } from "@/features/workspace/api";
import { cn } from "@/lib/cn";

export type SettingsSection =
  | "appearance"
  | "recording"
  | "notifications"
  | "email-assistant"
  | "ai"
  | "live-assist"
  | "knowledge-base"
  | "api"
  | "cookies"
  | "account";

const NAV: { section: SettingsSection; label: string; icon: LucideIcon; group: number }[] = [
  { section: "appearance", label: "Language & Appearance", icon: SlidersHorizontal, group: 0 },
  { section: "recording", label: "Recording & Privacy", icon: Video, group: 0 },
  { section: "notifications", label: "Compliance Notification", icon: Shield, group: 0 },
  { section: "email-assistant", label: "Email Assistant", icon: Mail, group: 1 },
  { section: "ai", label: "AI Settings", icon: Wand2, group: 2 },
  { section: "live-assist", label: "Live Assist", icon: Bot, group: 2 },
  { section: "knowledge-base", label: "Knowledge Base", icon: BookOpen, group: 2 },
  { section: "api", label: "MCP & API", icon: Code, group: 3 },
  { section: "cookies", label: "Cookies", icon: Cookie, group: 3 },
  { section: "account", label: "Account", icon: IdCard, group: 4 },
];

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-surface">{children}</div>;
}

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
  pro,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  pro?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-5 last:border-b-0">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-secondary" strokeWidth={1.8} />
        <div>
          <p className="flex items-center gap-2 font-display text-[15px] font-medium text-title">
            {title} {pro && <Badge tone="brand">PRO</Badge>}
          </p>
          <p className="text-13 text-text-muted">{description}</p>
        </div>
      </div>
      {children && <div className="pl-8">{children}</div>}
    </div>
  );
}

/** Read-only stand-in for a select (settings are placeholders in this demo). */
function FakeSelect({ value }: { value: string }) {
  const { openComingSoon } = useUI();
  return (
    <button
      type="button"
      onClick={() => openComingSoon("Changing this setting")}
      className="flex h-10 w-full max-w-md items-center rounded-md border border-line bg-subtle px-3 text-left text-sm text-body"
    >
      {value}
    </button>
  );
}

function ThemeTile({ value, label, icon: Icon }: { value: ThemePreference; label: string; icon: LucideIcon }) {
  const { preference, setPreference } = useTheme();
  const active = preference === value;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => setPreference(value)}
      className={cn(
        "flex h-20 w-24 flex-col items-center justify-center gap-2 rounded-lg border text-sm transition-colors",
        active
          ? "border-brand bg-brand-soft font-medium text-brand-text"
          : "border-line text-body hover:bg-subtle",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.8} />
      {label}
    </button>
  );
}

function Appearance() {
  return (
    <Card>
      <SettingRow
        icon={Moon}
        title="Theme"
        description="Choose how the application looks. Select System to automatically match your device settings."
      >
        <div className="flex flex-wrap gap-3">
          <ThemeTile value="light" label="Light" icon={Sun} />
          <ThemeTile value="dark" label="Dark" icon={Moon} />
          <ThemeTile value="system" label="System" icon={Monitor} />
        </div>
      </SettingRow>
      <SettingRow
        icon={SlidersHorizontal}
        title="Display language"
        description="Select the language to display in the app. Your meeting content is never translated."
      >
        <FakeSelect value="English" />
      </SettingRow>
    </Card>
  );
}

function Recording() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-base font-medium text-title">Recording</h3>
        <Card>
          <SettingRow icon={Video} title="Auto-record meetings" description="Fireflies notetaker will join and record your calendar events.">
            <FakeSelect value="Only meetings I own" />
          </SettingRow>
          <SettingRow icon={Video} title="Capture meeting video" description="Capture your meeting screen and shared content as video." pro />
          <SettingRow icon={SlidersHorizontal} title="Meeting language" description="For transcripts and summaries.">
            <FakeSelect value="English (Global)" />
          </SettingRow>
        </Card>
      </div>
      <div>
        <h3 className="mb-3 text-base font-medium text-title">Privacy &amp; Access</h3>
        <Card>
          <SettingRow icon={Shield} title="Meeting privacy" description="Defaults apply to all new meetings.">
            <FakeSelect value="Teammates & anyone with link" />
          </SettingRow>
          <SettingRow icon={Mail} title="Meeting recap email" description="Send a recap email to selected recipients after each meeting is processed.">
            <FakeSelect value="Only me" />
          </SettingRow>
        </Card>
      </div>
    </div>
  );
}

function Account() {
  const { data: me } = useMe();
  return (
    <Card>
      <div className="flex items-center gap-4 border-b border-line px-5 py-5">
        {me && <Avatar name={me.name} color={me.avatar_color} size={48} square />}
        <div>
          <p className="font-display text-base font-medium text-title">{me?.name}</p>
          <p className="text-sm text-text-muted">{me?.email}</p>
        </div>
      </div>
      <SettingRow icon={IdCard} title="Plan" description="You're on the Free Plan. Paid plans are not available in this demo." />
      <SettingRow icon={Shield} title="Authentication" description="Sign-in is not enabled: the app runs as a default demo user." />
    </Card>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Badge tone="brand" className="mb-3">
          Coming Soon
        </Badge>
        <p className="font-display text-lg text-title">{label}</p>
        <p className="mt-1 text-sm text-text-muted">These settings aren&apos;t available in this demo yet.</p>
      </div>
    </Card>
  );
}

export function SettingsPage({ section }: { section: SettingsSection }) {
  const { data: me } = useMe();
  const { openComingSoon } = useUI();
  const current = NAV.find((item) => item.section === section) ?? NAV[0]!;

  return (
    <div className="flex h-screen bg-page">
      <aside className="hidden w-[260px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-surface p-3 md:flex">
        <Link href="/" aria-label="Back to app" className="flex h-8 w-8 items-center justify-center rounded text-secondary hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3 px-1">
          {me && <Avatar name={me.name} color={me.avatar_color} size={36} square />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-title">{me?.email}</p>
            <p className="text-xs text-text-muted">Free Plan</p>
          </div>
        </div>
        <SegmentedControl
          ariaLabel="Settings scope"
          value="personal"
          onChange={(value) => value === "team" && openComingSoon("Team settings")}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          options={[
            { value: "personal", label: "Personal" },
            { value: "team", label: "Team" },
          ]}
        />
        <nav aria-label="Settings" className="flex flex-col">
          {NAV.map((item, index) => {
            const Icon = item.icon;
            const newGroup = index > 0 && NAV[index - 1]!.group !== item.group;
            return (
              <Link
                key={item.section}
                href={`/settings/${item.section}`}
                aria-current={item.section === section ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm",
                  newGroup && "mt-2 border-t border-line pt-2",
                  item.section === section ? "bg-muted font-medium text-title" : "text-secondary hover:bg-muted hover:text-title",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => openComingSoon("Referrals")}
          className="mt-auto flex h-9 items-center gap-2.5 rounded-md bg-brand-soft px-2.5 text-sm text-brand-text"
        >
          <Gift className="h-4 w-4" /> Refer and earn $5 each
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-page px-4 sm:px-8">
          <Link href="/" aria-label="Back" className="rounded p-1 text-secondary hover:bg-muted md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Search settings"
            aria-label="Search settings"
            readOnly
            onFocus={() => openComingSoon("Settings search")}
            wrapperClassName="w-full max-w-sm"
          />
        </div>
        <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-8">
          <h2 className="mb-5 text-lg font-medium text-title">{current.label}</h2>
          {section === "appearance" && <Appearance />}
          {section === "recording" && <Recording />}
          {section === "account" && <Account />}
          {!["appearance", "recording", "account"].includes(section) && <Placeholder label={current.label} />}
        </div>
      </main>
    </div>
  );
}
