"use client";

import { Sparkles, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";
import { Modal } from "@/components/ui/modal";

export function ComingSoonDialog({
  feature,
  onClose,
}: {
  feature: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={feature !== null}
      onOpenChange={(open) => !open && onClose()}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-accent" />
          {feature} is coming soon
        </span>
      }
      description="This feature isn't available in this demo yet. Meetings, transcripts, summaries and action items are fully functional."
      footer={
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    />
  );
}

/** Full-page placeholder for sections that are out of scope (Analytics, Integrations, ...). */
export function ComingSoonPage({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <Badge tone="brand" className="mb-3">
          Coming Soon
        </Badge>
        <h2 className="text-2xl font-normal text-title">{title}</h2>
        <p className="mt-2 text-sm text-text-muted">{description}</p>
      </div>
    </div>
  );
}
