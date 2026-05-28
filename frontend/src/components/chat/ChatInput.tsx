import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, disabled, isStreaming, placeholder }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSend(v);
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-2 shadow-sm focus-within:border-[var(--tenant-primary)] focus-within:ring-2 focus-within:ring-[var(--tenant-primary)]/20 dark:border-ink-700 dark:bg-ink-800">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKey}
          rows={1}
          placeholder={placeholder ?? "Ask anything about the menu…"}
          disabled={disabled}
          className={cn(
            "min-h-[36px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none dark:text-ink-100",
          )}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900"
            aria-label="Stop"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-opacity",
              "[background-color:var(--tenant-primary)]",
              (disabled || !value.trim()) && "opacity-40",
            )}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
