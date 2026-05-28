# TableAI public-page design references

Curated 2026-05-15. Used to drive v4 of the public menu/chat page.

## The honest verdict

**There is no good open-source restaurant landing page template.** Every restaurant-specific repo
on GitHub is either templated Bootstrap, sub-30 stars, or both. The talent in 2024-2026 is in
**modern marketing/landing pages and component libraries**, not in industry-specific themes.

The win is to **compose** from world-class component libraries with a warm palette and serif display
typography to make it read as a restaurant brand, rather than search for a restaurant template.

## Verified finalists (live-demo checked; all ≥ 1k★ except where noted)

| Name | Repo | Live | Stars | License | What to use it for |
|------|------|------|-------|---------|---------------------|
| **shadcn/ui** | https://github.com/shadcn-ui/ui | https://ui.shadcn.com | **114k** | MIT | Component primitives, CSS-variable theming, command palette, sheets, dialogs. Foundation. |
| **Magic UI** | https://github.com/magicuidesign/magicui | https://magicui.design | **21k** | MIT | Animated marketing components (bento, marquee, animated grid, shimmer buttons, text reveal). |
| **Aceternity UI** | (copy-paste) | https://ui.aceternity.com | n/a | MIT (per cmp) | Best hero/wow components — mesh-gradient shaders, 3D cards, sparkles. Use ≤ 3 at a time. |
| **Midday landing** | https://github.com/midday-ai/midday | https://midday.ai | 14.3k | AGPL | The compositional reference — how shadcn + motion-primitives fit together in one site. |
| **Dub landing** | https://github.com/dubinc/dub | https://dub.co | 23.5k | AGPL | Canonical "best of 2024" SaaS narrative — headline → 3 pillars → screenshot → logos. |
| **Motion-Primitives** | https://github.com/ibelick/motion-primitives | https://motion-primitives.com | 5.5k | MIT | Tight framer-motion primitives: scroll-progress, text-reveal, morphing dialog. |
| **Cal.com** | https://github.com/calcom/cal.com | https://cal.com | 42.5k | AGPL | Reference for numbered feature walkthroughs and notification-mockup illustrations. |
| **21st.dev** | https://github.com/serafimcloud/21st | https://21st.dev | 5.2k | MIT | Marketplace of shadcn-compatible blocks — heroes, pricing, AI chat blocks. |
| **Supabase apps/www** | https://github.com/supabase/supabase | https://supabase.com | 75k+ | Apache-2.0 | Big-budget brand site, open source. Feature cards + Launch Week patterns. |
| **OpenStatus** | https://github.com/openstatusHQ/openstatus | https://openstatus.dev | 8.7k | AGPL | Crisp dev-tool landing entirely from shadcn primitives — study in restraint. |
| **Documenso** | https://github.com/documenso/documenso | https://documenso.com | 12.9k | AGPL | Trust-focused B2B landing — alternating image/text feature stack, compliance badges. |

## Awwwards-tier inspiration (no code — design references only)

- **WatchHouse** (https://watchhouse.com) — coffee retailer with three coordinated "personality" identities. Sophisticated photography on neutral surfaces.
- **Sakazuki** (https://sakazuki.io) — minimalist Japanese beverage collective. Big-type-first.
- **Banh Mi World** (https://banhmiworld.ca), **Tout Bien Pils** (https://toutbienpils.com),
  **Eatnaked** (https://eatnaked.co), **Don Molinico** (https://donmolinico.es) — Awwwards 2024-26 food/drink picks.

## What was rejected from earlier research (and why)

- Sub-1k-star "restaurant landing" GitHub repos (arnobt78/Restaurant-Landing-Page-*, hasanulmukit/restaurant-website-nextjs, etc.) — the open-source restaurant template space is genuinely weak.
- Vercel Commerce — gold for **ordering UX**, not for landing pages.
- shadcn-ui/taxonomy — archived; mentioned for completeness only.

## v4 build recipe (composed)

| Layer | Source | Components used |
|-------|--------|-----------------|
| Foundation | shadcn-style (custom in `components/ui/`) | Existing Button, Card, Sheet primitives. CSS-variable theming. |
| Marketing components | Magic UI | `Marquee`, `AnimatedGridPattern`, custom bento grid |
| Wow moments | Aceternity (exactly 3) | `BackgroundGradientAnimation`, `Card3D` (perspective tilt), `Sparkles` |
| Motion polish | Motion-Primitives-style | `TextReveal` (scroll-coupled word fade) |
| Narrative structure | Midday + Dub | Hero → marquee → "How it works" (01/02/03) → menu → marquee prompts → CTA footer |
| Typography | Tenant `theme.fonts` | LLM picks per restaurant — Bubbakoo's got Red Hat Display + Prompt |
| Palette | Tenant `theme.palette` | LLM picks per restaurant — Bubbakoo's got #93C854 / #FF6B35 |

## Files added in Pass 4

- `frontend/src/pages/PublicMenuPageV4.tsx`
- `frontend/src/components/v4/aceternity/BackgroundGradientAnimation.tsx`
- `frontend/src/components/v4/aceternity/Card3D.tsx`
- `frontend/src/components/v4/aceternity/Sparkles.tsx`
- `frontend/src/components/v4/magicui/Marquee.tsx`
- `frontend/src/components/v4/magicui/AnimatedGridPattern.tsx`
- `frontend/src/components/v4/motion-primitives/TextReveal.tsx`
- CSS keyframes appended to `frontend/src/index.css`
- `?v4` short-circuit in `MenuPage.tsx`
- v3/v4 toggle in `TemplateGalleryPage.tsx`
