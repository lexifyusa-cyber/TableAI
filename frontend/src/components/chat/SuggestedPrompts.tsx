interface Props {
  prompts: string[];
  onPick: (p: string) => void;
}

export function SuggestedPrompts({ prompts, onPick }: Props) {
  if (prompts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition-all hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)] dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
