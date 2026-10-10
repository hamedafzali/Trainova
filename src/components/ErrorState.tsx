import { AlertTriangle } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="enter-fade rounded-card border border-border bg-danger/[0.04] text-center py-12 px-6 space-y-3">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/10 text-danger" aria-hidden>
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="font-semibold text-lg text-ink">{title}</p>
      <p className="text-body-sm text-inkSoft max-w-xs mx-auto">{body}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
