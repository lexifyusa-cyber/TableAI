import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-ink-200/70 dark:bg-ink-700/40",
        className,
      )}
    />
  );
}
