import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import type { ChatMessage } from "@/types/api";
import { cn } from "@/lib/cn";

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isError = msg.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-primary)] text-xs font-bold text-white">
          AI
        </div>
      )}
      <div
        className={cn(
          "chat-prose max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-ink-900 text-white dark:bg-white dark:text-ink-900"
            : "rounded-bl-md bg-white text-ink-900 ring-1 ring-ink-200 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700",
          isError && "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-200",
        )}
      >
        {isError && (
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold">
            <AlertCircle className="h-3 w-3" />
            Error
          </div>
        )}
        {msg.content ? (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        ) : msg.status === "streaming" ? (
          <div className="flex items-center gap-1 py-0.5">
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-ink-400" />
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-ink-400" />
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-ink-400" />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
