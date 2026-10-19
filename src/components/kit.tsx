// The page kit: the building blocks of the Home redesign (AIDesigner run
// 373a5132), shared so every tab speaks the same visual language. Styling
// lives in globals.css (.hero-card, .ai-card, .btn-volt-glow, .eyebrow,
// .rise) and the theme tokens; see docs/DESIGN_SYSTEM.md.

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRight, Sparkles } from "lucide-react";

type Icon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

/** Tab-level page header: display title, optional subtitle, actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

const iconBtn =
  "grid h-11 w-11 shrink-0 place-items-center rounded-control border border-border bg-surface text-inkSoft transition-colors hover:text-ink active:scale-95";

/** Square bordered icon button, as the bell on Home. A link with `href`, else a button. */
export function IconButton({
  icon: I,
  label,
  href,
  onClick,
  pressed,
}: {
  icon: Icon;
  label: string;
  href?: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  const inner = <I className="h-5 w-5" aria-hidden />;
  if (href)
    return (
      <Link href={href} className={iconBtn} aria-label={label} title={label}>
        {inner}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${iconBtn} ${pressed ? "border-accent/40 text-accent" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
    >
      {inner}
    </button>
  );
}

/** Small uppercase label with an optional leading icon or dot. */
export function Eyebrow({ icon: I, children, className = "text-muted", id }: { icon?: Icon; children: ReactNode; className?: string; id?: string }) {
  return (
    <p id={id} className={`eyebrow ${className}`}>
      {I && <I className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </p>
  );
}

/** The navy hero card: eyebrow, display title, body, and usually one glow button. */
export function HeroCard({
  eyebrow,
  title,
  titleId,
  watermark: W,
  children,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId?: string;
  watermark?: Icon;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`hero-card rise ${className}`} aria-labelledby={titleId}>
      {W && (
        <W className="pointer-events-none absolute -right-6 -top-4 -z-10 h-36 w-36 -rotate-12 text-white/[0.03]" strokeWidth={1.5} aria-hidden />
      )}
      {eyebrow && <div className="eyebrow mb-3 text-white/60">{eyebrow}</div>}
      <h2 id={titleId} className="font-display mb-2 text-[2rem] font-bold leading-tight text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

export type Stat = {
  label: string;
  /** Small line between label and value (e.g. which exercise). */
  kicker?: ReactNode;
  value: ReactNode;
  unit?: string;
  /** Line under the value: a trend, a date, a hint. */
  foot?: ReactNode;
  footClass?: string;
  /** Extra content between value and foot (e.g. a sparkline). */
  extra?: ReactNode;
  title?: string;
};

/** A row of stats in one card, split by hairlines. */
export function StatBand({
  stats,
  label,
  columns,
  className = "",
}: {
  stats: Stat[];
  label: string;
  /** CSS grid-template-columns; equal columns by default. */
  columns?: string;
  className?: string;
}) {
  return (
    <section
      className={`card grid divide-x divide-border p-0 ${className}`}
      style={{ gridTemplateColumns: columns ?? `repeat(${stats.length}, minmax(0, 1fr))` }}
      aria-label={label}
    >
      {stats.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col justify-between px-3 py-4 first:pl-4" title={s.title}>
          <div className="min-w-0">
            <h3 className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wide text-muted">{s.label}</h3>
            {s.kicker && <p className="mb-1 truncate text-[11px] leading-tight text-inkSoft">{s.kicker}</p>}
            <p className="flex items-baseline gap-1">
              <span className="font-display truncate text-2xl font-bold text-ink">{s.value}</span>
              {s.unit && <span className="text-xs text-muted">{s.unit}</span>}
            </p>
            {s.extra}
          </div>
          {s.foot && <p className={`mt-2 text-[10px] font-medium ${s.footClass ?? "text-muted"}`}>{s.foot}</p>}
        </div>
      ))}
    </section>
  );
}

/** Section title with an optional "View all"-style action. */
export function SectionHeader({
  id,
  title,
  action,
}: {
  id?: string;
  title: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {action &&
        (action.href ? (
          <Link href={action.href} className="text-sm font-medium text-accent">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="-mr-2 min-h-11 px-2 text-sm font-medium text-accent">
            {action.label}
          </button>
        ))}
    </div>
  );
}

/** A card holding a divided list of rows. */
export function ListCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`card divide-y divide-border overflow-hidden p-0 ${className}`}>{children}</ul>;
}

/** Rounded square holding a row's icon. `tone="accent"` tints it lime. */
export function IconTile({ icon: I, tone = "neutral" }: { icon: Icon; tone?: "neutral" | "accent" | "ai" }) {
  const cls =
    tone === "accent" ? "bg-accent/15 text-accent" : tone === "ai" ? "bg-ai/15 text-ai" : "bg-surface2 text-inkSoft group-hover:text-ink";
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-control transition-colors ${cls}`}>
      <I className="h-5 w-5" aria-hidden />
    </span>
  );
}

/** One list row: icon tile, title and meta, trailing content, chevron when it navigates. */
export function ListRow({
  href,
  onClick,
  icon,
  tone,
  title,
  meta,
  trailing,
}: {
  href?: string;
  onClick?: () => void;
  icon?: Icon;
  tone?: "neutral" | "accent" | "ai";
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {icon && <IconTile icon={icon} tone={tone} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-xs text-muted">{meta}</span>}
      </span>
      {trailing}
      {(href || onClick) && <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
  const cls = "group flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface2/50 active:bg-surface2";
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** The violet coach card: a short grounded note and a way into the coach. */
export function CoachCard({
  text,
  href = "/coach",
  cta = "Ask coach",
  eyebrow = "Coach",
  className = "",
}: {
  text: ReactNode;
  href?: string;
  cta?: string;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <section className={`ai-card rise ${className}`} aria-label={eyebrow}>
      <Sparkles className="pointer-events-none absolute -bottom-4 -right-4 -z-10 h-24 w-24 text-ai/10" aria-hidden />
      <p className="eyebrow mb-3 text-ai">
        <Sparkles className="h-3.5 w-3.5 fill-current" aria-hidden /> {eyebrow}
      </p>
      <p className="mb-5 max-w-[90%] text-[15px] font-medium leading-snug text-ink">{text}</p>
      <Link
        href={href}
        className="group flex min-h-11 w-full items-center justify-between border-t border-ai/20 pt-3 text-ai transition-colors hover:text-ink"
      >
        <span className="text-sm font-medium">{cta}</span>
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </section>
  );
}

/** An empty list slot: dashed outline, centred hint, optional action. */
export function EmptySlot({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border px-5 py-6 text-center text-sm text-muted">
      {children}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
