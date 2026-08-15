export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="enter-fade rounded-card border border-dashed border-border bg-surface text-center py-14 px-6 space-y-3">
      <p className="text-3xl" aria-hidden>
        {icon}
      </p>
      <p className="font-semibold text-lg text-ink">{title}</p>
      <p className="text-body-sm text-inkSoft max-w-xs mx-auto">{body}</p>
      {action}
    </div>
  );
}
