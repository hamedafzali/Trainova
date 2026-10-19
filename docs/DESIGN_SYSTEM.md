# Trainova design system

The visual language comes from the Home redesign (AIDesigner ultradesign run
`373a5132`). The design is dark-first: a navy canvas with lime as the single
action colour and violet for anything the AI wrote. Light mode uses the same
structure with the lime moved to a deep green for text.

The design has three layers:

1. **Palette:** CSS variables in `src/app/globals.css`, mapped to Tailwind
   names in `tailwind.config.ts`.
2. **Surface classes:** `.card`, `.hero-card`, `.ai-card` and the others in the
   `@layer components` block of `globals.css`.
3. **Page kit:** the React building blocks in `src/components/kit.tsx`.

If you are building a page, start from the kit. Use a surface class directly
only when no kit component fits, and never use a raw hex value.

## Palette

Colours are stored as `R G B` triplets, so opacity modifiers work
(`bg-accent/15`, `border-ai/30`). Every text pairing clears WCAG AA (4.5:1)
on the base, card and well backgrounds.

| Tailwind     | Role                         | Dark      | Light     |
| ------------ | ---------------------------- | --------- | --------- |
| `bg`         | Page canvas                  | `#0A1119` | `#F3F5F8` |
| `elevated`   | Tab bar, sticky headers      | `#0B121A` | `#FFFFFF` |
| `surface`    | Cards                        | `#141B25` | `#FFFFFF` |
| `surface2`   | Wells: inputs, chips, tiles  | `#1E252F` | `#E8ECF1` |
| `border`     | Hairlines                    | `#252D39` | `#DBE0E7` |
| `ink`        | Primary text                 | `#F5F7FA` | `#0E151E` |
| `inkSoft`    | Secondary text               | `#A6AFBA` | `#545E6B` |
| `muted`      | Labels, meta                 | `#8F98A4` | `#58626F` |
| `accent`     | Lime text and icons          | `#C3E201` | `#546500` |
| `accentFill` | Lime fills                   | `#C3E201` | `#C3E201` |
| `onAccent`   | Text on lime                 | `#0A1119` | `#0A1119` |
| `ai`         | Coach and AI output          | `#B9A0FF` | `#6E4FD8` |
| `green`      | Success                      | `#49C77A` | `#1D7A44` |
| `gold`       | Personal records             | `#F5D06B` | `#876400` |
| `amber`      | Warnings                     | `#F2B84B` | `#8A5A00` |
| `flame`      | Streaks                      | `#FF9A57` | `#B24012` |
| `night`      | Hero surface (both themes)   | `#141B25` | `#141B25` |
| `volt`       | Lime on the hero             | `#C3E201` | `#C3E201` |

Rules:

- **Lime is for doing.** Use it for the one primary action on a screen, the
  active tab and progress. Don't use it for decoration.
- **Violet is for interpretation.** Anything the model wrote is shown in an
  `.ai-card` or `CoachCard`, so it is never mistaken for measured data.
- **Gold means a PR and flame means a streak.** Don't reuse them for
  anything else.
- **The hero is night in both themes.** Text on it uses `text-white`,
  `text-white/60` and `volt`, never the theme tokens.

**Radii:** `rounded-chip` 8px, `rounded-control` 12px (buttons, tiles),
`rounded-card` 16px, `rounded-sheet` 24px (hero card, sheets, tab bar).

**Type:** Inter. `.font-display` is the heavy, tight, tabular voice used for
titles, hero text and stat numbers. Page titles use `.page-title`. Small
uppercase labels use `.eyebrow` or `.section-label`.

**Motion:** `.rise` is a 0.6s fade-up for cards on first paint. The
reduced-motion rule in `globals.css` turns it off.

## Surface classes

| Class            | Use                                                              |
| ---------------- | ---------------------------------------------------------------- |
| `.card`          | Default container: surface, hairline border, soft shadow, `p-6`.  |
| `.hero-card`     | The one navy hero per page, with a lime glow at the top right.    |
| `.ai-card`       | Violet-tinted card on a faint grid, for AI output.                |
| `.btn-volt-glow` | The hero's full-width primary action.                             |
| `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` | Standard buttons. |
| `.eyebrow`       | Uppercase label row, with an optional icon or dot.                |
| `.badge-*`       | Status pills: neutral, accent, success, warning, danger, gold, flame. |
| `.chip`          | Selectable tag (44px tall). Use a `.badge-*` instead for anything that isn't tappable. |

**Card padding.** On phones, cards stacked in one column share the same
inner side padding, so their content lines up: `card p-4 sm:p-5`. Keep the
bare `.card` (`p-6`) for standalone cards such as empty states or forms on
their own page.

**Estimates.** Anything computed from rules rather than measured (readiness,
nutrition targets) carries a visible "Estimate" label and a one-line note on
what it's based on. Show the number only when the input supports it. With no
check-in, for example, readiness shows the band but no score.

## Page kit (`src/components/kit.tsx`)

| Component       | What it is                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| `PageHeader`    | Title, optional subtitle, and actions on the right. Every tab starts here. |
| `IconButton`    | 44px bordered square. Pass `href` for a link, otherwise `onClick`; `pressed` for toggles. |
| `HeroCard`      | Navy hero with an eyebrow, a display title, an optional watermark icon and children. Put one `btn-volt-glow` inside. |
| `StatBand`      | A row of `Stat`s in one card, split by hairlines. `columns` sets an uneven grid, e.g. `"1.2fr 1fr 1fr"`. |
| `SectionHeader` | Section title with an optional "View all" action.                          |
| `ListCard` + `ListRow` | Divided list. A row takes an icon tile (`tone` neutral, accent or ai), a title, meta and trailing content. It shows a chevron when it navigates. |
| `IconTile`      | The rounded icon square used inside rows.                                   |
| `CoachCard`     | Violet coach note with a link into the coach.                               |
| `EmptySlot`     | Dashed placeholder for an empty list, with an optional action.              |
| `Eyebrow`       | Standalone uppercase label.                                                 |

## Page templates

Each tab follows the same order. Leave out the parts a page doesn't need.

```
<main className="mx-auto max-w-3xl space-y-8 pb-20 md:pb-0">
  <PageHeader title subtitle actions={<IconButton …/>} />
  <HeroCard …>  <Link className="btn-volt-glow">…</Link>  </HeroCard>   // the one next action
  <StatBand stats={[…]} />                                              // the numbers that matter
  <CoachCard text="…" />                                                // AI reading, kept apart
  <section>
    <SectionHeader title action={{ label: "View all", href }} />
    <ListCard> <ListRow …/> … </ListCard>   or   <EmptySlot>…</EmptySlot>
  </section>
</main>
```

How the tabs use it:

- **Home:** greeting header, then a hero (resume, next workout or none), a
  week strip, a StatBand (volume, streak, PR), a CoachCard and recent
  workouts.
- **Plan:** PageHeader with a "new program" button, a calendar row, then
  your programs and the library.
- **Workouts:** PageHeader with exercise, history and new-workout buttons, a
  resume hero while a workout is live, your programs, single workouts, a
  CoachCard ("Build me a workout") and a browse row.
- **Progress:** PageHeader with a calendar button, a summary StatBand, then
  tabbed charts and workout rows.
- **Profile:** PageHeader, an identity hero (avatar, name, workouts logged),
  then settings groups. Each group is a `.section-label` above a divided
  `.card`.
- **History, Calendar, Exercises, Coach:** PageHeader, then the content
  specific to that page.

The live workout screen (`/session/[id]`) is full-screen and has its own
header. It doesn't use the tab template. Each exercise card is a per-set
table (SET · PREVIOUS · value columns). The active set has a lime border and
expands in place to show the steppers. Tap a logged row to fix it.

The inbox (`/inbox`) is one `.card` list. Each row has a tone tile: accent for
something to do, amber for a warning, green for a win, surface2 for info.
