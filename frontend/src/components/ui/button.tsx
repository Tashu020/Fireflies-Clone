"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "upgrade" | "soft";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover disabled:opacity-50",
  secondary:
    "border border-line bg-surface text-body hover:bg-subtle disabled:text-placeholder shadow-sm",
  ghost: "text-secondary hover:bg-muted hover:text-title disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-danger-hover disabled:opacity-50",
  upgrade: "border border-upgrade-border bg-upgrade-bg text-upgrade-text hover:brightness-95",
  soft: "bg-brand-soft text-brand-text hover:bg-brand-soft-hover",
};

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-9 gap-2 px-3.5 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded font-display font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: "sm" | "md";
  tooltip?: boolean;
}

/** Square icon-only button. `label` is used for both aria-label and the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, size = "md", tooltip = true, className, children, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded text-secondary transition-colors hover:bg-muted hover:text-title disabled:cursor-not-allowed disabled:opacity-40",
        size === "md" ? "h-8 w-8" : "h-7 w-7",
        active && "bg-brand-soft text-brand-text hover:bg-brand-soft-hover hover:text-brand-text",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});
