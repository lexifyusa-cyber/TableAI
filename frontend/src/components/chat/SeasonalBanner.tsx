import { Sparkles } from "lucide-react";

interface Props {
  nextHoliday?: {
    name: string;
    date: string;
    days_away: number;
    emoji?: string | null;
    theme_accent?: string | null;
  } | null;
}

/**
 * Tiny holiday-aware banner shown above the chat when a culturally-relevant
 * holiday is within 14 days. Uses the holiday's theme_accent as a hue and
 * emoji as the flourish. Non-intrusive — hides itself when no holiday is near.
 */
export function SeasonalBanner({ nextHoliday }: Props) {
  if (!nextHoliday) return null;
  const accent = nextHoliday.theme_accent || "#f97316";
  const phrase =
    nextHoliday.days_away === 0
      ? `Today is ${nextHoliday.name}`
      : nextHoliday.days_away === 1
        ? `Tomorrow is ${nextHoliday.name}`
        : `${nextHoliday.name} in ${nextHoliday.days_away} days`;

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-sm"
      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}dd)` }}
    >
      <span aria-hidden className="text-lg leading-none">
        {nextHoliday.emoji || <Sparkles className="h-4 w-4" />}
      </span>
      <span>{phrase}</span>
      <span className="ml-auto text-xs font-normal text-white/80">
        {new Date(nextHoliday.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>
  );
}
