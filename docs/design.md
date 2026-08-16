# Design System — Pragmatic v2 (Slice 2)

## Goal
Completely new visual language, not recognizable as LibreChat. No blue/gray LibreChat palette, no copied layout.

## Palette
- **Ink** `#0A0E1A` (primary text/primary button) — deep navy-black, used for primary CTA
- **Sand** `#F8F7F4` / `#F2F0E9` / `#E8E4D9` — warm paper background, card borders
- **Jade** `#0E9384` — accent for streaming, focus rings, new-chat CTA, health dot
- **Plum** `#7C3AED` — secondary accent for badges/model tags
- **Mist** `#94A3B8` — muted text/borders

Tailwind `theme.extend.colors` in `apps/web/tailwind.config.js`. All components use these tokens only.

## Typography
- **Display**: `Space Grotesk` + `Prompt` 500/600 — headings
- **Body**: `Prompt` + `Noto Sans Thai` 400/500 — Thai + English, `font-sans`
- **Mono**: `JetBrains Mono` for code/health json

`apps/web/src/index.css` imports Prompt/Space Grotesk, applies `font-sans` globally.

## Shape & Elevation
- Radii: `xl 16px`, `2xl 20px`, `3xl 24px` — all cards/buttons use `rounded-xl/2xl`
- Shadows: `soft 0 2px 16px rgba(10,14,26,0.06)`, `lifted 0 8px 30px rgba(10,14,26,0.10)`, `glow 0 0 0 3px rgba(14,147,132,0.15)` for focus

## Primitives
`apps/web/src/components/ui/*`:
- `Button` variants: `primary` (ink), `jade`, `ghost`, `outline`, `subtle`; sizes `sm/md/lg/icon`
- `Input`/`Textarea` — white bg, `border-sand-200`, focus `ring-jade/20`
- `Card`/`CardHeader`/`CardContent` — white, `border-sand-200`, `shadow-soft`
- `Badge` variants: `sand`, `jade`, `plum`, `ink`

`apps/web/src/lib/cn.ts` — `clsx + tailwind-merge`.

## Layout
- Header 56px `bg-white/90 backdrop-blur` sticky, left brand (P ink square), center title, right health + user email
- Sidebar 320px `bg-sand-100/60` sticky, top `AuthPanel`, middle `Sidebar` (conversations), bottom meta
- Main `bg-sand`, chat takes `calc(100vh-56px)` flex column
- Footer `border-sand-200 bg-white` 11px
- Mobile: hamburger toggles sidebar `hidden lg:flex`

## Brand
Header: ink square P, "Pragmatic v2" + jade badge, subtitle “พื้นที่ทำงาน AI ของคุณ — ดีไซน์ใหม่ ไม่ใช่ LibreChat”. No LibreChat icons/colors.

## Accessibility
- Focus `ring-jade/30 ring-offset-sand`
- `antialiased`, 6px custom scrollbar `bg-mist-500/40`
- Thai `lang="th"` in `index.html`

## References
- Tailwind, Hono examples not used for UI, but API patterns remain.
