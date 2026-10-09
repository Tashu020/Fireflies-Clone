"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { NavRailContent } from "@/components/layout/nav-rail";

/** The main navigation as a slide-in drawer (small screens and the meeting page's ☰ button). */
export function NavDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-overlay" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[248px] animate-slide-in-left shadow-xl focus:outline-none">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">Main navigation</Dialog.Description>
          <NavRailContent expanded onNavigate={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
