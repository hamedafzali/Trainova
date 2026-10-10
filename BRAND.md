# Trainova brand

Trainova is a strength-training tracker. Its promise is **less friction between the bar and the log**:
a set is logged in two taps, and the coach answers in plain words. The brand should feel like
good gym equipment. It is solid and quiet, and it is never in the way.

## Logo

The mark is a **T whose crossbar is a barbell**. It is a letter and a lift at once.

| Asset | Use |
|---|---|
| `public/brand/mark.svg` | The bare mark (`currentColor`), for placing on any surface |
| `public/icon.svg` | App icon / favicon: white mark on the accent tile, rounded corners |
| `public/icon-maskable.svg` | Android adaptive icon: full-bleed tile, mark inside the 80% safe zone |
| `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png` | Raster exports for the manifest and iOS |
| `public/brand/lockup.svg`, `lockup-dark.svg` | Mark and wordmark side by side, for light and dark backgrounds |
| `src/components/Logo.tsx` (`LogoMark`) | The mark in the UI. It follows the theme's accent |

Rules:
- Keep clear space of at least ¼ of the tile width around the tile.
- The mark is always white on accent, or accent/ink on a plain surface. Do not use gradients on the mark itself,
  outlines, drop shadows or rotation.
- Below 24px, use the tile (`icon.svg`), not the bare mark.
- The wordmark is "Trainova", set in the system sans at weight 700 with slightly tight tracking. It is never all caps.

After changing the SVGs, re-export the PNGs at the listed sizes by rendering each SVG in a headless browser
with a transparent background. Keep the mark in `Logo.tsx` in sync with the SVGs.

## Color

Tokens live in `src/app/globals.css` (as RGB triplets) and are exposed through `tailwind.config.ts`.
Use the Tailwind names in components and never raw hex.

| Role | Token / class | Light | Dark |
|---|---|---|---|
| Accent (links, active, focus) | `text-accent` | #2F5FE0 | #4F7FFF |
| Accent fill (primary buttons, logo tile) | `bg-accentFill` + `text-onAccent` | #2F5FE0 | #426BD6 |
| Canvas | `bg-bg` | #F7F7F9 | #0A0A0D |
| Card | `bg-surface` | #FFFFFF | #17181D |
| Well (inputs, steppers) | `bg-surface2` | #F0F1F5 | #1E1F26 |
| Text | `text-ink` / `text-inkSoft` / `text-muted` | #14151A / #55586A / #646670 | #F5F5F7 / #A8ACB8 / #898C97 |
| Done, progress | `text-green` | #187E4B | #34C77B |
| Records | `text-gold` | #8F6808 | #FFC94A |
| Streak | `text-flame` | #BE4614 | #FF8A3D |
| Caution / deload | `text-amber` | #996208 | (see css) |
| Destructive | `text-danger` | #AF392C | (see css) |

Every text/background pair is tuned to WCAG AA (4.5:1). When you add a color, check it on both themes.
Status colors carry meaning, so pair them with an icon or a word and never rely on color alone.

## Type

- **Family:** the native system stack (SF Pro on Apple devices, Segoe UI or Roboto elsewhere). It adds zero network
  requests and no font flash.
- **Scale** (`tailwind.config.ts`): display 40, h1 28, h2 20, h3 17, body 15, body-sm 13, caption 11 (uppercase eyebrows only).
- Numbers that change (weights, reps, timers, stats) use `tabular-nums`.

## Iconography

- Use [lucide](https://lucide.dev) icons at a 2px stroke, sized 16/20/24. Do not use emoji as icons.
- Decorative icons get `aria-hidden`. Icon-only buttons get an `aria-label` and a 44×44px hit area.

## Motion

- Use `ease-standard` (cubic-bezier(0.22, 1, 0.36, 1)) at 150, 200 or 250ms. Exits are faster than entries.
- Motion confirms an action (a set completing, a sheet opening). It is never decoration that loops.
- Everything respects `prefers-reduced-motion`.

## Voice

The app speaks like a good coach on the gym floor: short, specific and warm.

| Do | Don't |
|---|---|
| "Add your first exercise to start logging." | "Oops! Looks like there's nothing here yet!" |
| "Go up to 82.5 kg" | "You're crushing it!!! Time to level up 💪" |
| "It may have been deleted on another device." | "Error 404: resource not found" |

- Use the second person and the active voice, with the verb first on buttons ("Start workout", "Log set", "Apply").
- Use sentence case everywhere and keep exclamation marks rare.
- Give the user the facts rather than hype: numbers, the next step, and why.
- Write health-adjacent coaching cautiously. The coach is not a doctor (see `src/services/ai/safety.ts`).
