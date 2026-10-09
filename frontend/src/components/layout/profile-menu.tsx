"use client";

import { LogOut, Monitor, Moon, Settings, Sun, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useTheme } from "@/components/providers/theme-provider";
import { useUI } from "@/components/providers/ui-provider";
import { Avatar } from "@/components/ui/avatar";
import {
  Menu,
  MenuCheckItem,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { useMe } from "@/features/workspace/api";

export function ProfileMenu() {
  const { data: me } = useMe();
  const { preference, setPreference } = useTheme();
  const { openComingSoon } = useUI();
  const router = useRouter();

  return (
    <Menu>
      <MenuTrigger aria-label="Account menu" className="rounded-md p-0.5 hover:bg-muted">
        <Avatar name={me?.name ?? "?"} color={me?.avatar_color ?? "#98A2B3"} size={30} square />
      </MenuTrigger>
      <MenuContent className="min-w-[260px]">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar name={me?.name ?? "?"} color={me?.avatar_color ?? "#98A2B3"} size={36} square />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-title">{me?.name}</p>
            <p className="truncate text-xs text-text-muted">{me?.email}</p>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem icon={<Settings className="h-4 w-4" />} onSelect={() => router.push("/settings/appearance")}>
          Settings
        </MenuItem>
        <MenuSub>
          <MenuSubTrigger icon={<Sun className="h-4 w-4" />}>Theme</MenuSubTrigger>
          <MenuSubContent>
            <MenuCheckItem icon={<Sun className="h-4 w-4" />} checked={preference === "light"} onSelect={() => setPreference("light")}>
              Light
            </MenuCheckItem>
            <MenuCheckItem icon={<Moon className="h-4 w-4" />} checked={preference === "dark"} onSelect={() => setPreference("dark")}>
              Dark
            </MenuCheckItem>
            <MenuCheckItem icon={<Monitor className="h-4 w-4" />} checked={preference === "system"} onSelect={() => setPreference("system")}>
              System
            </MenuCheckItem>
          </MenuSubContent>
        </MenuSub>
        <MenuItem icon={<Users className="h-4 w-4" />} onSelect={() => openComingSoon("Teams")}>
          Team
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut className="h-4 w-4" />}
          onSelect={() => toast.info("Authentication is not enabled in this demo.")}
        >
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
