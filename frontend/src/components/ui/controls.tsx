"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Fireflies' pill-style segmented control ("Notes | AI Skills", "Hosted | Shared", ...). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-md bg-muted p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded px-3 text-sm font-medium transition-colors",
              active
                ? "bg-surface text-body shadow-sm dark:bg-strong"
                : "text-text-muted hover:text-body",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Underlined tabs ("AskFred | Transcript"). */
export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex h-12 items-end gap-5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-full items-center gap-1.5 border-b-2 font-display text-sm transition-colors",
              active
                ? "border-brand-text text-brand-text"
                : "border-transparent text-secondary hover:text-title",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  invalid?: boolean;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leftIcon, rightSlot, invalid, className, wrapperClassName, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border bg-surface px-3 transition-shadow focus-within:border-brand focus-within:shadow-focus",
        invalid ? "border-danger" : "border-line",
        wrapperClassName,
      )}
    >
      {leftIcon && <span className="flex shrink-0 text-placeholder">{leftIcon}</span>}
      <input
        ref={ref}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-sm text-title outline-none placeholder:text-placeholder focus-visible:shadow-none",
          className,
        )}
        {...props}
      />
      {rightSlot}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-title outline-none transition-shadow placeholder:text-placeholder focus:border-brand focus:shadow-focus",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-body">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      className={cn("h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--brand)]", className)}
    />
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "bg-muted text-secondary",
    brand: "bg-brand-soft text-brand-text",
    success: "bg-success-bg text-success-text",
    warning: "bg-warning-bg text-warning-text",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-sans text-2xs font-medium text-text-muted">
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded", className)} />;
}
