"use client";

import { ThemeToggle } from "@/components/ThemeToggle";

const COLOR_GROUPS: { label: string; swatches: { name: string; cls: string }[] }[] = [
  {
    label: "Background layers",
    swatches: [
      { name: "bg (base)", cls: "bg-bg" },
      { name: "elevated", cls: "bg-elevated" },
      { name: "surface (card)", cls: "bg-surface" },
      { name: "surface2 (well)", cls: "bg-surface2" },
    ],
  },
  {
    label: "Text",
    swatches: [
      { name: "ink (primary)", cls: "bg-ink" },
      { name: "inkSoft (secondary)", cls: "bg-inkSoft" },
      { name: "muted", cls: "bg-muted" },
    ],
  },
  {
    label: "Accent",
    swatches: [
      { name: "accent", cls: "bg-accent" },
      { name: "accentHover", cls: "bg-accentHover" },
      { name: "accentPressed", cls: "bg-accentPressed" },
      { name: "accentDim", cls: "bg-accentDim" },
    ],
  },
  {
    label: "Semantic",
    swatches: [
      { name: "green (success)", cls: "bg-green" },
      { name: "danger (error)", cls: "bg-danger" },
      { name: "amber (warning)", cls: "bg-amber" },
      { name: "gold (PR)", cls: "bg-gold" },
    ],
  },
  {
    label: "Border",
    swatches: [{ name: "border", cls: "bg-border" }],
  },
];

export default function StyleGuidePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Style Guide</h1>
          <p className="page-subtitle">Design token preview — not linked in app nav</p>
        </div>
        <ThemeToggle />
      </header>

      {/* Typography */}
      <section className="space-y-4">
        <h2 className="section-label">Typography</h2>
        <div className="card space-y-5">
          <div className="text-display">Display 40 / 700</div>
          <div className="text-h1">Heading 1 — 28 / 700</div>
          <div className="text-h2">Heading 2 — 20 / 650</div>
          <div className="text-h3">Heading 3 — 17 / 600</div>
          <div className="text-body">Body 15 / 400 — the quick brown fox jumps over the lazy dog.</div>
          <div className="text-body-sm text-inkSoft">Body small 13 / 400 — secondary supporting text.</div>
          <div className="section-label">Caption / eyebrow — 11 / 600 uppercase</div>
          <div className="text-stat font-mono tabular-nums">142.5 kg</div>
        </div>
      </section>

      {/* Color */}
      <section className="space-y-4">
        <h2 className="section-label">Color</h2>
        <div className="card space-y-6">
          {COLOR_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="text-body-sm font-semibold text-inkSoft">{group.label}</div>
              <div className="flex flex-wrap gap-4">
                {group.swatches.map((s) => (
                  <div key={s.name} className="flex flex-col items-center gap-2">
                    <div className={`h-16 w-16 rounded-control border border-border ${s.cls}`} />
                    <span className="text-body-sm text-muted">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="section-label">Buttons</h2>
        <div className="card flex flex-wrap gap-4">
          <button className="btn-primary">Primary</button>
          <button className="btn-secondary">Secondary</button>
          <button className="btn-ghost">Ghost</button>
          <button className="btn-danger">Danger</button>
          <button className="btn-primary" disabled>
            Disabled
          </button>
        </div>
      </section>

      {/* Inputs */}
      <section className="space-y-4">
        <h2 className="section-label">Inputs</h2>
        <div className="card flex flex-wrap gap-4">
          <input className="input max-w-xs" aria-label="Text input" placeholder="Text input" />
          <input className="num w-24" aria-label="Number input" placeholder="0" />
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-4">
        <h2 className="section-label">Cards</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card">
            <div className="text-h3">Card title</div>
            <p className="text-body-sm text-inkSoft mt-1">
              Resting on the base layer with a hairline border and a soft shadow.
            </p>
          </div>
          <div className="card shadow-elevated">
            <div className="text-h3">Elevated card</div>
            <p className="text-body-sm text-inkSoft mt-1">
              Uses shadow-elevated — reserved for floating elements.
            </p>
          </div>
        </div>
      </section>

      {/* Chips */}
      <section className="space-y-4">
        <h2 className="section-label">Chips</h2>
        <div className="card flex flex-wrap gap-3">
          <span className="chip">Chest</span>
          <span className="chip">Back</span>
          <span className="chip">Legs</span>
        </div>
      </section>

      {/* Badges */}
      <section className="space-y-4">
        <h2 className="section-label">Badges</h2>
        <div className="card flex flex-wrap gap-3">
          <span className="badge-neutral">Neutral</span>
          <span className="badge-accent">Accent</span>
          <span className="badge-success">Completed</span>
          <span className="badge-warning">RPE 9</span>
          <span className="badge-danger">Skipped</span>
        </div>
      </section>
    </main>
  );
}
