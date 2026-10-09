import { cn } from "@/lib/cn";

/** Brand mark: a pink-to-purple tile with a stylized "F" (inspired by the Fireflies mark). */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Fireflies"
    >
      <defs>
        <linearGradient id="ff-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F670C7" />
          <stop offset="55%" stopColor="#E0257F" />
          <stop offset="100%" stopColor="#7A5AF8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ff-logo)" />
      <rect x="8" y="7" width="16" height="5" rx="1.5" fill="#fff" />
      <rect x="8" y="14" width="11" height="5" rx="1.5" fill="#fff" opacity="0.92" />
      <rect x="8" y="21" width="5" height="5" rx="1.5" fill="#fff" opacity="0.85" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      {!collapsed && (
        <span className="font-display text-[17px] font-medium tracking-tight text-title">
          fireflies
        </span>
      )}
    </span>
  );
}
