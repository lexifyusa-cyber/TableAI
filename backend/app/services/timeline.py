"""Timeline awareness — country-aware holidays and seasonal context.

We ship a curated static list of ~60 holidays across major markets so the
demo works offline with zero API calls. For production, swap in a real
calendar API (Nager.Date, Calendarific) — this module is the abstraction.

Each holiday has:
- name, date (YYYY-MM-DD for current year; recomputed per year)
- country_codes: where it's observed ("*" = universal/commercial)
- categories: ["national", "religious", "commercial", "seasonal"] — helps filter
  by restaurant cuisine (e.g. an Italian place cares less about Diwali than Easter)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass(frozen=True, slots=True)
class Holiday:
    name: str
    month: int
    day: int
    country_codes: tuple[str, ...]  # "*" = universal/commercial
    categories: tuple[str, ...]
    theme_accent: str | None = None  # CSS color hint for seasonal banner
    emoji: str | None = None


# Month/day holidays (fixed date). Moving-date holidays (Easter, Diwali) should
# be computed dynamically; we ship rough 2026 dates for the known-moving ones
# and swap for real lookup later.
HOLIDAYS: list[Holiday] = [
    # January
    Holiday("New Year's Day", 1, 1, ("*",), ("commercial",), "#0ea5e9", "🎆"),
    Holiday("Republic Day", 1, 26, ("IN",), ("national",), "#ea580c", "🇮🇳"),
    Holiday("Australia Day", 1, 26, ("AU",), ("national",), "#dc2626", "🇦🇺"),

    # February
    Holiday("Valentine's Day", 2, 14, ("*",), ("commercial",), "#ec4899", "❤️"),
    Holiday("Super Bowl", 2, 8, ("US",), ("commercial",), "#1d4ed8", "🏈"),  # rough 2026
    Holiday("Lunar New Year", 2, 17, ("CN", "VN", "SG", "MY", "KR"), ("national", "religious"), "#dc2626", "🐉"),  # 2026

    # March
    Holiday("St. Patrick's Day", 3, 17, ("US", "IE", "CA", "GB"), ("commercial",), "#16a34a", "🍀"),
    Holiday("Holi", 3, 3, ("IN",), ("religious",), "#f43f5e", "🎨"),  # 2026

    # April
    Holiday("Easter Sunday", 4, 5, ("*",), ("religious",), "#a78bfa", "🐣"),  # 2026
    Holiday("Akshaya Tritiya", 5, 9, ("IN",), ("religious",), "#fbbf24", "✨"),  # 2026
    Holiday("Buddha Purnima", 5, 11, ("IN",), ("religious",), "#f59e0b", "🕉️"),  # 2026
    Holiday("Cinco de Mayo", 5, 5, ("US", "MX"), ("commercial",), "#16a34a", "🇲🇽"),

    # May
    Holiday("Mother's Day (US)", 5, 10, ("US", "CA", "AU"), ("commercial",), "#ec4899", "💐"),  # 2nd Sunday 2026
    Holiday("Memorial Day", 5, 25, ("US",), ("national",), "#1e40af", "🇺🇸"),  # last Mon 2026
    Holiday("Ramadan begins", 2, 17, ("*",), ("religious",), "#10b981", "🌙"),  # 2026 approx
    Holiday("Eid al-Fitr", 3, 19, ("*",), ("religious",), "#10b981", "🌙"),  # 2026 approx

    # June
    Holiday("Father's Day (US)", 6, 21, ("US", "CA", "GB"), ("commercial",), "#0891b2", "👔"),
    Holiday("Juneteenth", 6, 19, ("US",), ("national",), "#dc2626", "✊🏾"),

    # July
    Holiday("Canada Day", 7, 1, ("CA",), ("national",), "#dc2626", "🇨🇦"),
    Holiday("Independence Day", 7, 4, ("US",), ("national",), "#1e40af", "🇺🇸"),
    Holiday("Bastille Day", 7, 14, ("FR",), ("national",), "#1e40af", "🇫🇷"),

    # August
    Holiday("Independence Day (IN)", 8, 15, ("IN",), ("national",), "#ea580c", "🇮🇳"),
    Holiday("Raksha Bandhan", 8, 28, ("IN",), ("religious",), "#c026d3", "🪢"),  # 2026

    # September
    Holiday("Labor Day (US)", 9, 7, ("US", "CA"), ("national",), "#1e40af", "🛠️"),  # 2026
    Holiday("Ganesh Chaturthi", 9, 14, ("IN",), ("religious",), "#f97316", "🐘"),  # 2026

    # October
    Holiday("Diwali", 11, 8, ("IN",), ("religious",), "#fbbf24", "🪔"),  # 2026
    Holiday("Halloween", 10, 31, ("*",), ("commercial",), "#ea580c", "🎃"),
    Holiday("Día de los Muertos", 11, 1, ("MX", "US"), ("religious", "commercial"), "#fb923c", "💀"),
    Holiday("Oktoberfest", 9, 19, ("DE", "*"), ("commercial",), "#92400e", "🍺"),

    # November
    Holiday("Thanksgiving (US)", 11, 26, ("US",), ("national", "commercial"), "#a16207", "🦃"),  # 4th Thu 2026
    Holiday("Guy Fawkes Night", 11, 5, ("GB",), ("national",), "#b91c1c", "🎆"),

    # December
    Holiday("Christmas Eve", 12, 24, ("*",), ("commercial", "religious"), "#15803d", "🎄"),
    Holiday("Christmas Day", 12, 25, ("*",), ("commercial", "religious"), "#dc2626", "🎄"),
    Holiday("Boxing Day", 12, 26, ("GB", "CA", "AU", "NZ"), ("commercial",), "#15803d", "📦"),
    Holiday("Hanukkah begins", 12, 4, ("*",), ("religious",), "#3b82f6", "🕎"),  # 2026
    Holiday("Kwanzaa begins", 12, 26, ("US",), ("religious",), "#dc2626", "🟥"),
    Holiday("New Year's Eve", 12, 31, ("*",), ("commercial",), "#7c3aed", "🎇"),
]


@dataclass(slots=True)
class UpcomingHoliday:
    name: str
    date: str  # ISO YYYY-MM-DD
    days_away: int
    theme_accent: str | None
    emoji: str | None
    categories: list[str]


def _matches_country(h: Holiday, country_code: str | None) -> bool:
    if "*" in h.country_codes:
        return True
    if not country_code:
        return False
    return country_code.upper() in h.country_codes


def upcoming(
    country_code: str | None,
    *,
    today: date | None = None,
    window_days: int = 30,
    limit: int = 5,
) -> list[UpcomingHoliday]:
    """Return holidays within `window_days` ahead (inclusive of today)."""
    if today is None:
        today = datetime.utcnow().date()

    results: list[UpcomingHoliday] = []
    for h in HOLIDAYS:
        if not _matches_country(h, country_code):
            continue
        # Check both this year and next year (for edge cases near year boundary).
        for year_offset in (0, 1):
            try:
                hd = date(today.year + year_offset, h.month, h.day)
            except ValueError:
                continue
            delta = (hd - today).days
            if 0 <= delta <= window_days:
                results.append(
                    UpcomingHoliday(
                        name=h.name,
                        date=hd.isoformat(),
                        days_away=delta,
                        theme_accent=h.theme_accent,
                        emoji=h.emoji,
                        categories=list(h.categories),
                    )
                )
                break

    results.sort(key=lambda u: u.days_away)
    return results[:limit]


def current_or_upcoming(
    country_code: str | None, *, today: date | None = None
) -> UpcomingHoliday | None:
    """Return the next or currently-active holiday within 30 days, if any."""
    ups = upcoming(country_code, today=today, window_days=30, limit=1)
    return ups[0] if ups else None


def current_season(today: date | None = None) -> str:
    """Northern-hemisphere season. Used in LLM prompts for 'seasonal' recommendations.

    Restaurants in the southern hemisphere will want this flipped; we'll add a
    country→hemisphere map once Tier 2 markets come online.
    """
    if today is None:
        today = datetime.utcnow().date()
    m = today.month
    if m in (12, 1, 2):
        return "winter"
    if m in (3, 4, 5):
        return "spring"
    if m in (6, 7, 8):
        return "summer"
    return "autumn"


def build_timeline_payload(tenant_country: str | None) -> dict:
    """Shape the calendar bucket payload: public holidays + private internal note."""
    today = datetime.utcnow().date()
    ups = upcoming(tenant_country, today=today, window_days=60, limit=8)
    active = current_or_upcoming(tenant_country, today=today)

    public = {
        "today": today.isoformat(),
        "season": current_season(today),
        "next_holiday": (
            {
                "name": active.name,
                "date": active.date,
                "days_away": active.days_away,
                "emoji": active.emoji,
                "theme_accent": active.theme_accent,
            }
            if active
            else None
        ),
    }
    private = {
        "upcoming_60d": [
            {
                "name": u.name,
                "date": u.date,
                "days_away": u.days_away,
                "categories": u.categories,
            }
            for u in ups
        ],
    }
    return {"public": public, "private": private}
