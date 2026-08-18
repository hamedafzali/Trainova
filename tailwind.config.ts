import type { Config } from "tailwindcss";

// Every color below resolves through a CSS custom property defined in
// globals.css (":root" = light, "@media (prefers-color-scheme: dark)" +
// "[data-theme='dark']" = dark). Values are "R G B" triplets so Tailwind's
// alpha modifiers (bg-accent/20 etc.) keep working against whichever theme
// is active — see globals.css for the values themselves.
function themed(varName: string) {
  return `rgb(var(${varName}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Names kept stable — still referenced by session/profile/admin/etc.
        // Values now theme-aware via CSS variables instead of fixed hex/rgba.
        bg: themed("--c-bg-base"), // canvas
        elevated: themed("--c-bg-elevated"), // nav bars, sticky headers
        surface: themed("--c-bg-card"), // card
        surface2: themed("--c-bg-well"), // wells / inputs / steppers
        border: themed("--c-border"),
        accent: themed("--c-accent"), // primary / active
        accentHover: themed("--c-accent-hover"),
        accentPressed: themed("--c-accent-pressed"),
        accentDim: themed("--c-accent-dim"), // muted slate-blue — rest / secondary
        accentFill: themed("--c-accent-fill"), // solid-fill button/chip backgrounds (onAccent text)
        accentFillHover: themed("--c-accent-fill-hover"),
        danger: themed("--c-error"),
        muted: themed("--c-text-muted"),
        ink: themed("--c-text-primary"), // primary text
        inkSoft: themed("--c-text-secondary"), // secondary text
        // Informational state channel — distinct from `accent` (blue, reserved
        // for interactive/primary actions). Each hue has exactly one meaning,
        // applied identically wherever that state appears:
        green: themed("--c-success"), // positive momentum — volume trending up, exercise improving
        gold: themed("--c-gold"), // achievement — PR hit (rarest, most celebratory)
        amber: themed("--c-warning"), // needs attention — recovery/deload mode, volume trending down, fatigue (RPE >= 9)
        flame: themed("--c-flame"), // streak momentum — consecutive training days (absence of color = streak broken)
        onAccent: themed("--c-on-accent"), // text on accent fills
        onStatus: themed("--c-on-status"), // text on solid green/amber/danger/gold fills
        clayDeep: themed("--c-accent-pressed"), // pressed accent (alias, kept for callers)
      },
      fontFamily: {
        // The native system stack renders actual SF Pro on Apple devices —
        // the same face Fitness+ uses — with zero network requests or FOUT.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        // For tabular stat displays (weights, timers, calories) — a touch of
        // mechanical precision where numbers are the content, not the prose.
        mono: [
          "ui-monospace",
          "\"SF Mono\"",
          "\"Cascadia Code\"",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // Semantic scale on top of Tailwind's defaults (defaults stay intact
        // for existing screens). Each entry is [size, { lineHeight, letterSpacing, fontWeight }].
        display: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }], // 40px — hero stat, timer
        h1: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "700" }], // 28px — page-title
        h2: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "650" }], // 20px — section heading
        h3: ["1.0625rem", { lineHeight: "1.35", letterSpacing: "-0.005em", fontWeight: "600" }], // 17px — card title
        body: ["0.9375rem", { lineHeight: "1.5", fontWeight: "400" }], // 15px
        "body-sm": ["0.8125rem", { lineHeight: "1.4", fontWeight: "400" }], // 13px
        caption: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.08em", fontWeight: "600" }], // 11px — uppercase eyebrows/labels
        stat: ["2.125rem", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "700" }], // 34px — inline numeric readouts
        // Reserved for the single number that IS the point of a screen
        // (working weight, total volume, streak count) — not a general
        // upsize of text-stat. Use sparingly.
        hero: ["4.25rem", { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "700" }], // 68px
      },
      borderRadius: {
        // Semantic aliases over the existing scale (control/card match the
        // xl/2xl already in use — named so intent is explicit going forward).
        control: "12px", // buttons, inputs
        card: "16px",
        sheet: "24px", // modals, bottom sheets
      },
      boxShadow: {
        // Depth is mostly carried by the bg-layer step (base -> elevated ->
        // card) plus a hairline border; shadow is reserved for things that
        // truly float above the page (modals, dropdowns, popovers).
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
      },
      // Shared motion vocabulary for stateful UI transitions (hover/press,
      // chip selection, toggles, accordions, route/modal enters). 150ms for
      // micro-interactions, 200ms for compositional changes, 250ms for the
      // largest-traveling elements (route/modal enter) — chosen to match
      // durations already in use (.btn's duration-150, RestTimerBar's
      // duration-200) rather than inventing new numbers.
      transitionTimingFunction: {
        standard: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
        250: "250ms",
      },
      // NOTE: the four keyframes below are one-shot feedback moments (a set
      // completing, a PR, a rest-timer breathe cue), not stateful UI
      // transitions — that's why their durations sit outside the 150/200/250
      // scale above. Leave them as-is; don't "normalize" them onto it.
      keyframes: {
        completeWipe: {
          "0%": { backgroundColor: "transparent" },
          "40%": { backgroundColor: "rgba(110,158,107,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        popIn: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.12)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        prRing: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.07)" },
        },
        breathe: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        // Entry animation for routed page content and empty/error/skeleton
        // swaps — content "arrives" rather than snapping in. Kept subtle
        // (6px) per the "fast, not showy" brief.
        enterFade: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        completeWipe: "completeWipe 600ms ease-out",
        popIn: "popIn 180ms ease-out",
        prRing: "prRing 700ms ease-in-out 2",
        breathe: "breathe 1.6s ease-in-out infinite",
        // No fill-mode: "both"/"forwards" would leave transform: translateY(0)
        // applied forever, which creates a containing block and traps any
        // position:fixed descendant (rest timer, modals) inside this wrapper
        // instead of the real viewport. Letting the animation end reverts to
        // the element's un-animated base styles (transform: none, opacity: 1
        // — identical to the final keyframe), so the visual result is the same.
        enterFade: "enterFade 250ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
