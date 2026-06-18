# Trainova — UX/UI Redesign Proposal

Mobile-first, gym-floor-first. The workout screen is the product; everything else
is secondary. Optimise for: **near-zero keyboard, one thumb, low cognitive load,
sub-second set logging.**

---

## 1. UX critique — what's wrong and why

| # | Problem (current code) | Why it hurts in a gym | Fix |
|---|---|---|---|
| 1 | Weight & reps are `<input type=number>` ([SetRow.tsx](src/components/SetRow.tsx)) | Keyboard pops on every set; sweaty hands, mis-taps, covers half the screen between sets | Steppers + swipe + long-press wheel; keyboard becomes opt-in |
| 2 | Template editor also all numeric inputs | Editing a plan is a typing chore | Steppers + "apply to all sets" |
| 3 | Rest control is tiny ±15 text buttons | Hard to hit mid-set; no big affordance | Large dual steppers + draggable ring |
| 4 | "Complete" is a 40px ✓ at row end | Not a thumb-zone target; precise tap required | Full-width swipe-to-complete + big primary button |
| 5 | Neon teal on near-black ([tailwind.config.ts](tailwind.config.ts)) | Aggressive, low warmth, weak hierarchy; one accent does every job | Nude palette with **role-specific** colors |
| 6 | States are text ("Completed", "in progress") | No instant visual read of set/exercise/PR/fatigue | Color + shape state system |
| 7 | Template vs session vs history look identical (same cards) | Ambiguity about "plan vs today" | Distinct surface treatments + badges + iconography |
| 8 | All exercises render as one long scroll in a session | Lots of scrolling, easy to lose place mid-workout | Focus mode: one exercise at a time, swipe between |
| 9 | No haptics, no motion | No tactile confirmation; you stare to verify a tap landed | Haptic + micro-animation on every commit |
| 10 | Primary actions sit mid/low but mixed with destructive (Discard) | Fat-finger risk; thumb travel | Thumb-zone CTA, destructive behind long-press |

---

## 2. Interaction model (gesture + control system)

The core principle: **every training value is adjustable without the keyboard**, three ways
(progressive disclosure) — tap for coarse, swipe for flow, long-press for precision.

| Value | Tap (coarse) | Swipe (flow) | Long-press (precise) |
|---|---|---|---|
| **Weight** | `−` / `+` steppers, 1 plate-increment/tap (2.5 kg / 5 lb) | horizontal drag on the weight chip = continuous ± by increment | opens **wheel/spinner** snapped to increments |
| **Reps** | `−` / `+` steppers | horizontal drag on reps chip | numeric pad (only here, opt-in) |
| **Rest** | `−15` / `+15` | drag the timer ring to scrub | wheel in 5 s steps |
| **Complete set** | big primary button | **swipe set row right → complete** | — |
| **Skip / fail set** | — | swipe set row left → skip (muted red) | — |
| **Next/prev exercise** | tap progress dot | **swipe card up/down** | — |
| **Reorder** | — | — | long-press drag handle to reorder |
| **Set actions** | — | — | long-press a set → action sheet (warmup, duplicate, fail, delete) |

**Stepper mechanics:** tap = 1 step; **press-and-hold = auto-repeat** (accelerating) for big
jumps without a keyboard. Increment is unit-aware (`plateIncrement()` already exists in
[progression.ts](src/domain/progression.ts)).

**Wheel selector:** a vertical scroll-snap column of weights centered on the current value;
flick to spin, releases on the snapped plate value. CSS `scroll-snap-type: y mandatory` — no
JS physics needed, works offline.

**Haptics** (Web Vibration API; visual fallback where unsupported, e.g. iOS Safari):
- set completed → `vibrate(15)` (a crisp tick)
- new PR → `vibrate([0,35,40,35])` (double-pop)
- workout completed → `vibrate([0,30,30,30,30,60])` (rising)
- rest over → `vibrate([120,60,120])` (already shipped)

---

## 3. Workout screen redesign (core)

**Focus mode**: one exercise on screen, sets as a vertical rail, the current set enlarged.
Everything actionable lives in the bottom third (thumb zone); identity/info lives up top.

```
┌──────────────────────────────┐  ← top: low-reach, read-only
│  ‹  Full Body A      ●●●○○    │   exercise progress dots
│  ┌────┐  Leg Press            │
│  │IMG │  No.22 · quads        │   device image (real SVG) + name
│  └────┘                       │
│                               │
│  Set 2 of 3                   │   set rail (done=green, now=terracotta,
│  ① ✓   ②▶   ③                 │   upcoming=outline)
│                               │
│  prev  50 × 12   (ghost)      │  ← previous performance, muted/italic
│ ───────────────────────────── │
│        ┌─────────────────┐    │   CURRENT SET — large
│   −     │   52.5   kg     │  + │   weight: steppers + swipe + long-press wheel
│        └─────────────────┘    │
│   −     │     12   reps   │  + │
│                               │
│  ▓▓▓▓▓▓░░░  rest 1:12  −15 +15 │   rest ring appears after completing
│                               │  ← bottom: thumb zone
│  ╭───────────────────────────╮│
│  │   ✓  COMPLETE SET          ││   full-width primary (swipe-right too)
│  ╰───────────────────────────╯│
└──────────────────────────────┘
```

**Flow:**
1. Land on the first incomplete set, pre-filled with the **suggested load** (already computed
   by `suggestNextLoad`) and the **ghost previous** for that exact set.
2. Adjust via stepper/swipe if needed — usually you don't (suggestion is right).
3. **Complete** (button or swipe-right): green fill animates across the row, haptic tick,
   rest timer auto-starts, and the screen **auto-advances** to the next set.
4. Last set done → card auto-advances to the next exercise (swipe-up also works).
5. PR on a set → gold ring pulse on the set + gold toast + double-haptic.

**One-hand guarantees:** complete, ±weight, ±reps, and rest controls are all within a 75%-down
thumb arc. Nothing required for a normal set sits in the top 40% of the screen.

---

## 4. Visual system — nude palette with roles

Shift from the dark/neon theme to a **warm light nude** theme. One accent per *job* so state
is read by color, not text.

```ts
// tailwind.config.ts — theme.extend.colors
sand:       "#F4ECE1", // app canvas (base)
clayLight:  "#ECE0D1", // card surface (slightly darker nude)
clay:       "#E3D4C1", // raised wells / inputs / steppers
line:       "#D6C4AE", // borders, dividers
ink:        "#38302A", // primary text  (~10:1 on sand)
inkSoft:    "#6B5E50", // secondary text
muted:      "#9A8B79", // placeholders / tertiary
terracotta: "#BC6B47", // PRIMARY action + ACTIVE state
clayDeep:   "#9E5B3B", // pressed/active terracotta
olive:      "#7C8254", // REST + secondary accent
green:      "#6E9E6B", // SUCCESS / completed set (soft)
red:        "#C07A6E", // FAIL / skip (muted, not harsh)
gold:       "#C7A24B", // PR / highlight (subtle)
amber:      "#C98A5E", // FATIGUE (RPE ≥ 9) tint
onAccent:   "#FBF4EC", // text on terracotta/olive
```

**State → color mapping (the system):**

| State | Color | Treatment |
|---|---|---|
| Active session / current set | `terracotta` | filled chip, soft pulse |
| Completed set | `green` | filled row + ✓, slides in |
| Upcoming set | `line` | outline only |
| Failed / skipped | `red` | strikethrough value, muted |
| Personal record | `gold` | ring + shimmer + toast |
| High fatigue (RPE ≥ 9) | `amber` | left-edge tint on the set |
| Rest running | `olive` | ring + bottom bar |
| Template (plan) | `clay` + 📋 | flat card, "PLAN" tag |
| History (past) | `clayLight` + muted ink | lower contrast, date-led |

**Contrast:** `ink` on `sand` ≈ 10:1, `inkSoft` on `clayLight` ≈ 5:1 (both pass AA). Accents are
used for fills with `onAccent` text, never as thin text on nude.

**Tone:** soft, calm, "studio" not "neon gym." Rounded 16–24px corners, 1px `line` borders,
gentle shadows (`0 1px 2px rgba(56,48,42,.06)`), no glow.

---

## 5. Device (equipment) UI redesign

We already have structured `Device` entities + real SVG images + `DeviceAvatar`. The redesign
makes selection **visual-first and swipeable**:

```
Recently used  → [22][25][ 7][ 4][ 1]   ← horizontal strip, big tap targets
Filter         ( All )(Legs)(Back)(Chest)(Arms)   ← muscle-group pills
┌──────┐ ┌──────┐ ┌──────┐
│ IMG  │ │ IMG  │ │ IMG  │   ← swipe carousel of device cards
│Leg P.│ │Row   │ │Chest │
│●quads│ │●back │ │●chest│   ← muscle dot + name + No.
│ No.22│ │ No.7 │ │ No.1 │
└──────┘ └──────┘ └──────┘
```

**Card anatomy:** device image (the SVG), name, **muscle-group dot** (color-coded), machine
number badge. Tap a card = pick. **Muscle filter** maps to `device.category`/`primaryMuscle`
(both already on the entity). **Recently used** reuses `recentExerciseIds`. No typing unless you
search for something new.

---

## 6. Information architecture — kill plan/session/history ambiguity

Three surfaces, three distinct visual languages, never interchangeable:

| Surface | Identity | Visual language | Primary verb |
|---|---|---|---|
| **Plans** (templates/programs) | reusable, **undated** | `clay` cards, 📋 tag, no dates anywhere | **Start** |
| **Active workout** (session) | dated, single, live | `terracotta` accent, "● LIVE" pill, focus mode | **Complete / Finish** |
| **History** (past sessions) | dated, read-only | `clayLight`, date-led headers, muted | **View** |

Reinforced by the existing `status` model: Home shows the single active session as a glowing
`terracotta` "Continue" card and nothing else competes; with no active session, Plans are the
hero and "empty workout" is a quiet text link. Calendar/History never show a plan; Plans never
show a date.

---

## 7. Motion & feedback

Keep it sub-200ms and purposeful — confirmation, not decoration.

- **Set complete:** green wipe left→right across the row (180ms) + scale-punch on ✓ + haptic tick.
- **Auto-advance:** current set card slides up, next slides in (160ms ease-out).
- **Rest timer:** olive ring drains; gentle 1.5s breathing pulse so it's glanceable peripherally.
- **PR:** gold ring scales 1→1.08→1 with a soft shimmer sweep; gold toast; double-haptic.
- **Workout complete:** full-screen soft confetti-free "✓ Done" with a rising haptic.
- **Respect** `prefers-reduced-motion` → cross-fades only.

---

## 8. Mobile ergonomics

- **Thumb-zone CTAs:** complete / ±weight / ±reps / rest all in the bottom 35%.
- **Touch targets:** ≥ 56px for primary, ≥ 44px for steppers; generous spacing.
- **Navigation depth:** workout is a single screen; no drill-downs mid-set.
- **No-keyboard mode:** during an active session the numeric keyboard never auto-opens; it's
  reachable only via long-press → wheel/pad.
- **Offline-first:** all of the above is local-state + CSS; nothing waits on network (already
  the case via the local store + PWA).

---

## 9. Prioritized implementation roadmap

**P0 — Workout interaction (the core, highest ROI)**
1. Replace `SetRow` inputs with **stepper + swipe** weight/reps; press-hold auto-repeat.
2. **Swipe-to-complete** set row + full-width thumb-zone "Complete set" button.
3. **Auto-advance** to next set/exercise on completion; **focus mode** (one exercise on screen).
4. Haptics on complete / PR / finish.

**P1 — Nude visual system**
5. Swap palette tokens in `tailwind.config.ts` + `globals.css`; introduce the **state→color**
   system (completed/active/PR/fatigue/skip).
6. Differentiate Plan vs Session vs History surfaces + tags.

**P2 — Device selection**
7. Muscle-group filter pills + **recently-used strip** + **swipe carousel** of device cards
   (build on `DeviceAvatar` / `ExercisePicker`).

**P3 — Precision & polish**
8. Long-press **wheel/spinner** for weight & rest; long-press **set action sheet**.
9. **Drag-to-reorder** sets/exercises; set-complete + rest micro-animations; `reduced-motion`.

---

*Scope note:* P0 + P1 deliver ~80% of the felt improvement (keyboard gone, thumb-friendly,
warm legible hierarchy). P2/P3 add precision and delight. Each step is independently shippable
and offline-safe.
