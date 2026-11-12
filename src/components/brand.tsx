import { BookOpenText } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-800 to-blue-600 text-white shadow-sm shadow-blue-900/20",
        className,
      )}
    >
      <BookOpenText className="size-5" strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

export function BrandLockup({
  inverted = false,
  compact = false,
  className,
}: {
  inverted?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={inverted ? "bg-white/15 shadow-none ring-1 ring-white/25" : undefined} />
      <div className="leading-tight">
        <p className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>
          IPSA College
        </p>
        <p
          className={cn(
            "text-xs font-medium",
            inverted ? "text-blue-100" : "text-muted-foreground",
          )}
        >
          Library Management
        </p>
      </div>
    </div>
  );
}
