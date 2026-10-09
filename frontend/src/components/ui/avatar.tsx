import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  /** Transcript avatars in Fireflies are rounded squares; elsewhere they are circles. */
  square?: boolean;
  className?: string;
  /** Single letter (transcript style) instead of two initials. */
  single?: boolean;
}

export function Avatar({ name, color, size = 24, square, className, single }: AvatarProps) {
  const text = single ? (name.trim()[0] ?? "?").toUpperCase() : initials(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-medium text-white",
        square ? "rounded" : "rounded-full",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(9, Math.round(size * (single ? 0.55 : 0.4))),
      }}
    >
      {text}
    </span>
  );
}

interface StackPerson {
  id: number | string;
  name: string;
  avatar_color: string;
}

export function AvatarStack({
  people,
  max = 4,
  size = 24,
}: {
  people: StackPerson[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <Tooltip key={person.id} content={person.name}>
          <span className={cn("rounded-full ring-2 ring-[var(--bg-surface)]", index > 0 && "-ml-1.5")}>
            <Avatar name={person.name} color={person.avatar_color} size={size} />
          </span>
        </Tooltip>
      ))}
      {rest > 0 && (
        <span
          className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-muted text-2xs font-medium text-secondary ring-2 ring-[var(--bg-surface)]"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
