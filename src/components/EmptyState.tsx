import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="enter-fade rounded-card border border-dashed border-border bg-surface text-center py-14 px-6 space-y-3">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent" aria-hidden>
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-semibold text-lg text-ink">{title}</p>
      <p className="text-body-sm text-inkSoft max-w-xs mx-auto">{body}</p>
      {action}
    </div>
  );
}
