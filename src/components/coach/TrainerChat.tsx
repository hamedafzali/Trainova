"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { AlertTriangle, ArrowUp, LogIn, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { postAi, useAiStatus } from "@/lib/ai";
import { useCoachChat, type ChatMessage } from "@/lib/coachChat";
import { currentTrainerContext } from "@/lib/trainerContext";
import type { PageFocus } from "@/lib/pageFocus";
import type { TrainerAction } from "@/domain/trainer";
import { ActionCard } from "./ActionCard";

const SUGGESTIONS = [
  "My shoulder hurts on presses — what should I swap?",
  "How should I warm up before squats?",
  "How do I know when to add weight?",
];

type Reply = { reply: string; actions: TrainerAction[]; notice: string | null };

/** Inline **bold** only — the model is asked for plain text and "- " bullets. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (bullet) bullets.push(bullet[1]);
    else {
      flush();
      if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function Bubble({ m, onRetry }: { m: ChatMessage; onRetry?: () => void }) {
  const markApplied = useCoachChat((s) => s.markApplied);
  if (m.role === "user") {
    return (
      <div className="enter-fade flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accentFill px-4 py-2.5 text-sm text-onAccent">
          {m.content}
        </p>
      </div>
    );
  }
  return (
    <div className="enter-fade max-w-[92%] space-y-2">
      {m.notice && (
        <p className="flex gap-2 rounded-control border border-danger/30 bg-danger/[0.08] p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          {m.notice}
        </p>
      )}
      <div
        className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed ${
          m.error ? "border border-danger/30 bg-danger/[0.06] text-ink" : "bg-surface2 text-inkSoft"
        }`}
      >
        <RichText text={m.content} />
        {m.error && onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        )}
      </div>
      {m.actions && m.actions.length > 0 && (
        <ul className="space-y-2" aria-label="Suggested changes">
          {m.actions.map((a, i) => (
            <ActionCard key={i} action={a} applied={m.applied?.[i] ?? false} onApplied={() => markApplied(m.id, i)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Shell({
  children,
  onClear,
  onClose,
  sectionRef,
  panel,
  subtitle,
}: {
  children: ReactNode;
  onClear?: () => void;
  onClose?: () => void;
  sectionRef?: Ref<HTMLElement>;
  panel?: boolean;
  subtitle?: string;
}) {
  return (
    <section
      ref={sectionRef}
      className={panel ? "flex h-full min-h-0 flex-col gap-3 p-4" : "card flex scroll-mt-4 flex-col gap-4 p-4 sm:p-5"}
      aria-labelledby="coach-chat"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accentFill text-onAccent" aria-hidden>
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="coach-chat" className="font-semibold text-ink">
            {panel ? "Coach" : "Ask your coach"}
          </h2>
          <p className="truncate text-xs text-muted">
            {subtitle ?? "Knows your plans and recent workouts · can edit your plan when you approve"}
          </p>
        </div>
        {onClear && (
          <button type="button" onClick={onClear} className="btn-ghost px-2.5 py-1.5 text-xs" aria-label="Clear conversation">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="btn-ghost px-2.5 py-1.5 text-xs" aria-label="Close coach">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function TrainerChat({
  variant = "page",
  focus = null,
  onClose,
}: {
  variant?: "page" | "panel";
  /** What the client has open (assistant panel); sent with each question. */
  focus?: PageFocus | null;
  onClose?: () => void;
} = {}) {
  const panel = variant === "panel";
  const shell = { panel, onClose, subtitle: panel ? (focus?.label ? `Looking at: ${focus.label}` : "Knows your plans and workouts") : undefined };
  const ai = useAiStatus();
  const messages = useCoachChat((s) => s.messages);
  const add = useCoachChat((s) => s.add);
  const remove = useCoachChat((s) => s.remove);
  const clear = useCoachChat((s) => s.clear);
  const queued = useCoachChat((s) => s.queued);
  const sectionRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void useCoachChat.persist.rehydrate();
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (ask) setDraft(ask.slice(0, 500));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  const ask = async (text: string, { retry = false } = {}) => {
    const content = text.trim();
    if (!content || pending) return;
    if (!retry) add({ role: "user", content });
    setDraft("");
    setPending(true);
    try {
      const context = currentTrainerContext(focus?.viewing ?? null);
      const history = useCoachChat
        .getState()
        .messages.filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await postAi<Reply>("/api/ai/trainer", { context, messages: history });
      add({ role: "assistant", content: res.reply, actions: res.actions, notice: res.notice });
    } catch (e) {
      add({ role: "assistant", content: e instanceof Error ? e.message : "The coach couldn't answer.", error: true });
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  // Prompts from the coach tools above the chat.
  const ready = ai.available === true && ai.signedIn;
  useEffect(() => {
    if (panel || !queued || !ready || pending) return;
    const text = useCoachChat.getState().takeQueued();
    if (!text) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void ask(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, ready, pending, panel]);

  const retry = (errorId: string) => {
    remove(errorId);
    const lastUser = [...useCoachChat.getState().messages].reverse().find((m) => m.role === "user");
    if (lastUser) void ask(lastUser.content, { retry: true });
  };

  if (ai.available === null) {
    return (
      <Shell {...shell}>
        <div className="h-40 animate-pulse rounded-control bg-surface2" />
      </Shell>
    );
  }
  if (!ai.available) {
    return (
      <Shell {...shell}>
        <p className="text-sm text-inkSoft">
          The AI coach isn&apos;t switched on for this server. Your insights below are still calculated from your
          training — ask whoever runs this Trainova to add a Mistral API key to enable chat.
        </p>
      </Shell>
    );
  }
  if (!ai.signedIn) {
    return (
      <Shell {...shell}>
        <p className="text-sm text-inkSoft">
          Sign in to chat with your coach. It can build workouts, suggest swaps when something hurts, and explain
          stalls using your own logs.
        </p>
        <Link href="/profile" className="btn-primary self-start">
          <LogIn className="h-4 w-4" aria-hidden /> Sign in
        </Link>
      </Shell>
    );
  }

  const lastError = messages.length > 0 && messages[messages.length - 1].error ? messages[messages.length - 1].id : null;

  return (
    <Shell {...shell} sectionRef={sectionRef} onClear={messages.length ? clear : undefined}>
      <div
        ref={listRef}
        className={`space-y-4 overflow-y-auto pr-1 ${panel ? "min-h-0 flex-1" : "max-h-[60vh] min-h-[8rem]"}`}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-inkSoft">
              {panel
                ? "Ask anything — I can see your plans, your logged workouts and what you have open."
                : "Pick a coach tool above or ask anything. I answer from your plans and logged workouts, and offer changes you can apply with one tap."}
            </p>
            <div className="flex flex-wrap gap-2">
              {(focus?.suggestions ?? SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-sm text-inkSoft hover:bg-surface2 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} onRetry={m.id === lastError ? () => retry(m.id) : undefined} />)
        )}
        {pending && (
          <div className="inline-flex gap-1 rounded-2xl rounded-bl-md bg-surface2 px-4 py-3" aria-label="Coach is typing">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <label htmlFor="coach-input" className="sr-only">
          Message your coach
        </label>
        <textarea
          id="coach-input"
          ref={inputRef}
          value={draft}
          rows={1}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(draft);
            }
          }}
          placeholder="Ask about your training…"
          className="input max-h-36 min-h-[2.75rem] flex-1 resize-none py-2.5 [field-sizing:content]"
        />
        <button
          type="submit"
          className="btn-primary h-11 w-11 shrink-0 p-0"
          disabled={pending || !draft.trim()}
          aria-label="Send"
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      </form>
      <p className="-mt-2 text-[11px] text-muted">
        AI coach — not medical advice. Stop and see a professional for pain, dizziness or chest symptoms.
      </p>
    </Shell>
  );
}
