import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, Check, Flame, Send, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Trophy, Undo2 } from "lucide-react-native";
import { buildDeterministicInsights, type CoachInsight } from "@/domain/coach";
import { describeAction, type TrainerAction } from "@/domain/trainer";
import { postAi, setAiConsent, useAiStatus } from "@/lib/ai";
import { useCoachChat, type ChatMessage } from "@/lib/coachChat";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { applyTrainerAction, undoTrainerAction } from "@/lib/trainerActions";
import { currentTrainerContext } from "@/lib/trainerContext";
import { useTrainingSummary } from "@/lib/useCoachData";
import { Button, Card, EmptySlot, PageHeader, Row, Screen, SectionHeader, Txt } from "~/ui/kit";
import { alpha, radius, usePalette } from "~/ui/theme";

const SUGGESTIONS = [
  "My shoulder hurts on presses — what should I swap?",
  "How should I warm up before squats?",
  "How do I know when to add weight?",
];

type Reply = { reply: string; actions: TrainerAction[]; notice: string | null };

const INSIGHT_ICON: Record<CoachInsight["kind"], typeof Trophy> = {
  stall: AlertTriangle,
  pr: Trophy,
  volume_up: TrendingUp,
  volume_down: TrendingDown,
  missed: AlertTriangle,
  streak: Flame,
};

/** The coach: insights worked out on the device, plus the AI chat for signed-in accounts. */
export default function CoachScreen() {
  const p = usePalette();
  const { ask: preset } = useLocalSearchParams<{ ask?: string }>();
  const ai = useAiStatus();
  const ready = ai.available === true && ai.signedIn && ai.consented === true;
  const summary = useTrainingSummary();
  const insights = useMemo(() => buildDeterministicInsights(summary), [summary]);
  const messages = useCoachChat((s) => s.messages);
  const add = useCoachChat((s) => s.add);
  const remove = useCoachChat((s) => s.remove);
  const clear = useCoachChat((s) => s.clear);
  const [draft, setDraft] = useState(preset ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void useCoachChat.persist.rehydrate();
  }, []);

  const ask = async (text: string, opts: { retry?: boolean } = {}) => {
    const q = text.trim();
    if (!q || pending) return;
    if (!opts.retry) add({ role: "user", content: q });
    setDraft("");
    setPending(true);
    try {
      const history = useCoachChat
        .getState()
        .messages.filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await postAi<Reply>("/api/ai/trainer", { context: currentTrainerContext(null), messages: history });
      add({ role: "assistant", content: res.reply, actions: res.actions, notice: res.notice });
    } catch (e) {
      add({ role: "assistant", content: e instanceof Error ? e.message : "The coach couldn’t answer.", error: true });
    } finally {
      setPending(false);
    }
  };

  const retry = (errorId: string) => {
    remove(errorId);
    const lastUser = [...useCoachChat.getState().messages].reverse().find((m) => m.role === "user");
    if (lastUser) void ask(lastUser.content, { retry: true });
  };
  const lastError = messages.length > 0 && messages[messages.length - 1].error ? messages[messages.length - 1].id : null;

  const composer = ready ? (
    <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.bg }}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Ask your coach…"
        placeholderTextColor={p.muted}
        accessibilityLabel="Message to your coach"
        multiline
        maxLength={1000}
        style={{
          flex: 1,
          minHeight: 44,
          maxHeight: 120,
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: p.border,
          backgroundColor: p.well,
          color: p.ink,
          fontSize: 16,
        }}
      />
      <Pressable
        onPress={() => void ask(draft)}
        disabled={pending || !draft.trim()}
        accessibilityRole="button"
        accessibilityLabel="Send"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignSelf: "flex-end",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: p.volt,
          opacity: pending || !draft.trim() ? 0.4 : 1,
        }}
      >
        <Send color={p.onVolt} size={18} />
      </Pressable>
    </View>
  ) : null;

  return (
    <Screen edges={ready ? ["top"] : ["top", "bottom"]} footer={composer}>
      <PageHeader back title="Coach" subtitle="Read from your own logs. The chat can build and adjust workouts." />

      <View>
        <SectionHeader title="Insights" />
        {insights.length === 0 ? (
          <EmptySlot>Log a few workouts and your coach will point out stalls, records and trends here.</EmptySlot>
        ) : (
          <View style={{ gap: 10 }}>
            {insights.map((i) => {
              const I = INSIGHT_ICON[i.kind];
              const tone = i.severity === "success" ? p.success : i.severity === "warning" ? p.warning : p.accent;
              const body = (
                <Row gap={12} style={{ alignItems: "flex-start" }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: alpha(tone, 0.14) }}>
                    <I color={tone} size={17} />
                  </View>
                  <Txt v="bodySm" style={{ flex: 1 }}>
                    {i.message}
                  </Txt>
                </Row>
              );
              return (
                <Card key={i.id}>
                  {i.exerciseId ? (
                    <Pressable onPress={() => router.push(`/exercises/${i.exerciseId}`)} accessibilityRole="button">
                      {body}
                    </Pressable>
                  ) : (
                    body
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </View>

      <View>
        <SectionHeader
          title="Chat"
          action={ready && messages.length ? { label: "Clear", onPress: clear } : undefined}
        />
        {!ai.signedIn ? (
          <Card style={{ gap: 12 }}>
            <Txt v="bodySm">
              Sign in to chat with your coach. It can build workouts, suggest swaps when something hurts, and explain stalls using your own logs.
            </Txt>
            <Button label="Sign in in Profile" variant="secondary" onPress={() => router.push("/profile")} />
          </Card>
        ) : ai.available === null || ai.consented === null ? (
          <Card>
            <ActivityIndicator color={p.accent} />
          </Card>
        ) : !ai.available ? (
          <Card>
            <Txt v="bodySm">
              The AI coach isn’t reachable right now. Your insights above are still worked out from your training.
            </Txt>
          </Card>
        ) : !ai.consented ? (
          <ConsentCard />
        ) : (
          <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
            {messages.length === 0 ? (
              <View style={{ gap: 10 }}>
                <Txt v="bodySm" color={p.inkSoft}>
                  Ask anything. I answer from your plans and logged workouts, and offer changes you can apply with one tap.
                </Txt>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => void ask(s)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      minHeight: 44,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: pressed ? p.well : p.card,
                      justifyContent: "center",
                    })}
                  >
                    <Txt v="bodySm">{s}</Txt>
                  </Pressable>
                ))}
              </View>
            ) : (
              messages.map((m) => <Bubble key={m.id} m={m} onRetry={m.id === lastError ? () => retry(m.id) : undefined} />)
            )}
            {pending && (
              <Row>
                <ActivityIndicator color={p.ai} />
                <Txt v="meta">Coach is thinking…</Txt>
              </Row>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

function ConsentCard() {
  const p = usePalette();
  const [saving, setSaving] = useState(false);
  const allow = async () => {
    setSaving(true);
    const ok = await setAiConsent(true);
    setSaving(false);
    if (!ok) toast("Couldn’t save. Check your connection and try again.", { variant: "error" });
  };
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: radius.card, borderWidth: 1, borderColor: alpha(p.ai, 0.3), backgroundColor: alpha(p.ai, 0.07) }}>
      <Row gap={6}>
        <ShieldCheck color={p.ai} size={16} />
        <Txt v="h3">Allow AI coaching?</Txt>
      </Row>
      <Txt v="bodySm">
        To analyse your training, the AI coach sends your workout history, plans, profile (goal, experience, optional body stats) and any notes or
        limitations to our AI provider when you use an AI feature. Our server doesn’t keep your prompts or the coach’s replies.
      </Txt>
      <Button label="Allow and continue" busy={saving} onPress={allow} />
    </View>
  );
}

/** Inline **bold** only — the model is asked for plain text and "- " bullets. */
function inline(text: string, color: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Txt key={i} v="label" color={color}>
        {part.slice(2, -2)}
      </Txt>
    ) : (
      part
    ),
  );
}

function RichText({ text, color }: { text: string; color: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, i) => {
        const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
        return bullet ? (
          <Row key={i} gap={8} style={{ alignItems: "flex-start" }}>
            <Txt v="bodySm" color={color}>
              •
            </Txt>
            <Txt v="bodySm" color={color} style={{ flex: 1 }}>
              {inline(bullet[1], color)}
            </Txt>
          </Row>
        ) : (
          <Txt key={i} v="bodySm" color={color}>
            {inline(line.replace(/^#+\s*/, ""), color)}
          </Txt>
        );
      })}
    </View>
  );
}

function Bubble({ m, onRetry }: { m: ChatMessage; onRetry?: () => void }) {
  const p = usePalette();
  const markApplied = useCoachChat((s) => s.markApplied);
  if (m.role === "user")
    return (
      <View style={{ alignSelf: "flex-end", maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: 6, backgroundColor: p.night }}>
        <Txt v="bodySm" color="#FFFFFF">
          {m.content}
        </Txt>
      </View>
    );
  return (
    <View style={{ gap: 8, maxWidth: "95%" }}>
      <Row gap={6}>
        <Sparkles color={m.error ? p.error : p.ai} size={14} />
        <Txt v="eyebrow" color={m.error ? p.error : p.ai}>
          Coach
        </Txt>
      </Row>
      <RichText text={m.content} color={m.error ? p.error : p.ink} />
      {m.notice ? <Txt v="meta">{m.notice}</Txt> : null}
      {onRetry ? <Button small variant="secondary" label="Try again" onPress={onRetry} style={{ alignSelf: "flex-start" }} /> : null}
      {m.actions?.length ? (
        <View style={{ gap: 8 }}>
          {m.actions.map((a, i) => (
            <ActionCard key={i} action={a} applied={Boolean(m.applied?.[i])} onApplied={() => markApplied(m.id, i)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The web hands back web paths; map them onto the app's routes. */
const nativeHref = (href: string) => href.replace(/^\/templates\//, "/template/").replace(/^\/programs\//, "/program/");

function ActionCard({ action, applied, onApplied }: { action: TrainerAction; applied: boolean; onApplied: () => void }) {
  const p = usePalette();
  const [href, setHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changeId, setChangeId] = useState<string | null>(null);
  const { title, detail } = describeAction(action);
  // The recorded change behind this card (also found again after a reload).
  const change = useStore((s) =>
    applied ? s.planChanges.find((c) => (changeId ? c.id === changeId : c.actionType === action.type && c.title === title)) : undefined,
  );
  const undone = Boolean(change?.undoneAt);
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: radius.control, borderWidth: 1, borderColor: p.border, backgroundColor: p.card }}>
      <View style={{ gap: 2 }}>
        <Txt v="label">{title}</Txt>
        <Txt v="meta" color={error ? p.error : p.muted} lines={2}>
          {error ?? detail}
        </Txt>
      </View>
      {undone ? (
        <Txt v="meta">Undone</Txt>
      ) : applied ? (
        <Row>
          <Check color={p.success} size={16} />
          <Txt v="label" color={p.success} style={{ flex: 1 }}>
            Applied
          </Txt>
          {change ? (
            <Button
              small
              variant="ghost"
              icon={Undo2}
              label="Undo"
              onPress={() => {
                const r = undoTrainerAction(change.id);
                setError(r.ok ? null : r.error);
              }}
            />
          ) : null}
          {href ? <Button small variant="secondary" label="View" onPress={() => router.push(nativeHref(href) as never)} /> : null}
        </Row>
      ) : (
        <Button
          small
          label="Apply"
          style={{ alignSelf: "flex-start" }}
          onPress={() => {
            const r = applyTrainerAction(action);
            if (r.ok) {
              setHref(r.href);
              setChangeId(r.changeId);
              onApplied();
            } else setError(r.error);
          }}
        />
      )}
    </View>
  );
}
