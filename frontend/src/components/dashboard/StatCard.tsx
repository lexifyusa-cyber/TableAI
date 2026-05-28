import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface Props {
  icon?: ReactNode;
  label: string;
  value: string | number;
  delta?: string;
  tone?: "default" | "positive" | "negative";
}

export function StatCard({ icon, label, value, delta, tone = "default" }: Props) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-500">{label}</span>
          {icon && <span className="text-ink-400">{icon}</span>}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">
          {value}
        </div>
        {delta && (
          <div
            className={cn(
              "mt-1 text-xs font-medium",
              tone === "positive"
                ? "text-emerald-600"
                : tone === "negative"
                ? "text-red-600"
                : "text-ink-500",
            )}
          >
            {delta}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
