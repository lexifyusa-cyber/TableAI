import { cn } from "@/lib/cn";

interface Props {
  tags: string[];
  active: string | null;
  onChange: (tag: string | null) => void;
}

export function FilterBar({ tags, active, onChange }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <FilterPill active={active === null} onClick={() => onChange(null)}>
        All
      </FilterPill>
      {tags.map((tag) => (
        <FilterPill key={tag} active={active === tag} onClick={() => onChange(tag)}>
          <span className="capitalize">{tag.replace(/:/g, " ")}</span>
        </FilterPill>
      ))}
    </div>
  );
}

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200",
      )}
    >
      {children}
    </button>
  );
}
