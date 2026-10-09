"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;
export const MenuSub = Dropdown.Sub;

const contentClass =
  "z-50 min-w-[200px] animate-scale-in rounded-lg border border-line bg-elevated p-1 shadow-lg focus:outline-none";

export function MenuContent({
  children,
  align = "end",
  className,
  sideOffset = 6,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  sideOffset?: number;
}) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content align={align} sideOffset={sideOffset} className={cn(contentClass, className)}>
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  );
}

const itemClass =
  "flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm text-body outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-muted data-[disabled]:opacity-50";

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  disabled,
  shortcut,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <Dropdown.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(itemClass, danger && "text-danger data-[highlighted]:bg-danger-bg")}
    >
      {icon && <span className="flex h-4 w-4 items-center justify-center opacity-80">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-text-muted">{shortcut}</span>}
    </Dropdown.Item>
  );
}

export function MenuCheckItem({
  children,
  checked,
  onSelect,
  icon,
}: {
  children: ReactNode;
  checked: boolean;
  onSelect: () => void;
  icon?: ReactNode;
}) {
  return (
    <Dropdown.Item onSelect={onSelect} className={itemClass}>
      {icon && <span className="flex h-4 w-4 items-center justify-center opacity-80">{icon}</span>}
      <span className="flex-1">{children}</span>
      {checked && <Check className="h-4 w-4 text-brand-text" />}
    </Dropdown.Item>
  );
}

export function MenuSeparator() {
  return <Dropdown.Separator className="my-1 h-px bg-[var(--border)]" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <Dropdown.Label className="px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
      {children}
    </Dropdown.Label>
  );
}

export function MenuSubTrigger({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <Dropdown.SubTrigger className={itemClass}>
      {icon && <span className="flex h-4 w-4 items-center justify-center opacity-80">{icon}</span>}
      <span className="flex-1">{children}</span>
      <span aria-hidden className="text-text-muted">
        ›
      </span>
    </Dropdown.SubTrigger>
  );
}

export function MenuSubContent({ children }: { children: ReactNode }) {
  return (
    <Dropdown.Portal>
      <Dropdown.SubContent sideOffset={6} className={contentClass}>
        {children}
      </Dropdown.SubContent>
    </Dropdown.Portal>
  );
}
