"""Toast POS API client (stub).

Real Toast API access requires partner registration + per-restaurant OAuth,
which we wire up once a tenant has signed up. For demo-generation we rely on
the public website / Toast Online Ordering URL scraped via services.scraper.
"""

from dataclasses import dataclass


@dataclass
class ToastMenuItem:
    name: str
    description: str | None
    price_cents: int | None
    category: str | None


class ToastClient:
    """Placeholder. Implementation lands when we onboard our first paying restaurant."""

    def __init__(self, client_id: str, client_secret: str, base_url: str) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = base_url

    async def fetch_menu(self, restaurant_guid: str) -> list[ToastMenuItem]:
        raise NotImplementedError("Toast API integration deferred until first paying tenant.")
