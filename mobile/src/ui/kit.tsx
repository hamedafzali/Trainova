// Native page kit: the same building blocks as the web's components/kit.tsx
// (page header, hero card, list rows, stat band, coach card, buttons), drawn
// with React Native views and the theme tokens.
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Minus, Plus, Sparkles, X } from "lucide-react-native";
import { router } from "expo-router";
import { subscribeToasts, type ToastMessage } from "@/lib/toast";
import { alpha, font, radius, usePalette, type Palette } from "./theme";

export type Icon = ComponentType<{ color?: string; size?: number; strokeWidth?: number; fill?: string }>;

// ---------- text ----------

type TxtVariant = "title" | "h2" | "h3" | "body" | "bodySm" | "meta" | "eyebrow" | "display" | "label";

const TXT: Record<TxtVariant, TextStyle> = {
  title: { fontFamily: font.heavy, fontSize: 28, lineHeight: 31, letterSpacing: -0.6 },
  display: { fontFamily: font.heavy, fontSize: 24, lineHeight: 28, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  h2: { fontFamily: font.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  h3: { fontFamily: font.semibold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  bodySm: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 17 },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18 },
  eyebrow: { fontFamily: font.semibold, fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase" },
};

export function Txt({
  v = "body",
  color,
  style,
  children,
  lines,
  ...rest
}: {
  v?: TxtVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lines?: number;
  accessibilityRole?: "header" | "text";
}) {
  const p = usePalette();
  const fallback = v === "meta" || v === "eyebrow" ? p.muted : v === "bodySm" ? p.inkSoft : p.ink;
  return (
    <Text
      numberOfLines={lines}
      style={[TXT[v], { color: color ?? fallback }, style]}
      accessibilityRole={rest.accessibilityRole ?? (v === "title" || v === "h2" ? "header" : undefined)}
    >
      {children}
    </Text>
  );
}

// ---------- layout ----------

/** A tab or stack screen: safe area, scroll, 16px gutters and the page background. */
export function Screen({
  children,
  scroll = true,
  edges = ["top"],
  footer,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ("top" | "bottom")[];
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[{ padding: 16, paddingBottom: 40, gap: 20 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, padding: 16, gap: 20 }, contentStyle]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

/** Tab-level page header: display title, optional subtitle, actions on the right. */
export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: boolean }) {
  const p = usePalette();
  return (
    <View style={{ gap: 4 }}>
      {back && <BackButton />}
      <Row style={{ alignItems: "flex-start", justifyContent: "space-between" }} gap={12}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="title">{title}</Txt>
          {subtitle ? <Txt v="bodySm" color={p.muted}>{subtitle}</Txt> : null}
        </View>
        {actions ? <Row>{actions}</Row> : null}
      </Row>
    </View>
  );
}

export function BackButton({ label = "Back" }: { label?: string }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 44, marginLeft: -6 }}
    >
      <ChevronLeft color={p.accent} size={22} />
      <Txt v="label" color={p.accent}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Square bordered icon button, as the bell on Home. */
export function IconButton({
  icon: I,
  label,
  onPress,
  pressed,
  dot,
  disabled,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  pressed?: boolean;
  dot?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: pressed, disabled }}
      style={({ pressed: down }) => [
        s.iconBtn,
        { borderColor: pressed ? alpha(p.accent, 0.4) : p.border, backgroundColor: p.card, transform: [{ scale: down ? 0.95 : 1 }] },
        disabled && { opacity: 0.35 },
      ]}
    >
      <I color={pressed ? p.accent : p.inkSoft} size={20} />
      {dot && <View style={[s.dot, { backgroundColor: p.accentFill, borderColor: p.card }]} />}
    </Pressable>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: p.card, borderColor: p.border, shadowColor: "#000", shadowOpacity: p.dark ? 0 : 0.05 },
        padded && { padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The navy hero card with a lime glow in the corner (white and volt text only). */
export function HeroCard({ eyebrow, title, children, live }: { eyebrow: string; title: string; children?: ReactNode; live?: boolean }) {
  const p = usePalette();
  return (
    <View style={[s.hero, { backgroundColor: p.night }]}>
      <View pointerEvents="none" style={[s.glow, { backgroundColor: alpha(p.volt, 0.16) }]} />
      <Row gap={8}>
        {live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.volt }} /> : null}
        <Txt v="eyebrow" color={p.volt}>
          {eyebrow}
        </Txt>
      </Row>
      <Txt v="title" color="#FFFFFF" style={{ marginTop: 10, marginBottom: 8 }}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const p = usePalette();
  return (
    <Row style={{ justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 10 }}>
      <Txt v="h2">{title}</Txt>
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={10}>
          <Txt v="label" color={p.accent}>
            {action.label}
          </Txt>
        </Pressable>
      )}
    </Row>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      {children}
    </Card>
  );
}

export function ListRow({
  icon: I,
  title,
  meta,
  trailing,
  onPress,
  tone = "neutral",
  last,
}: {
  icon?: Icon;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  tone?: "neutral" | "accent" | "danger";
  last?: boolean;
}) {
  const p = usePalette();
  const fg = tone === "accent" ? p.accent : tone === "danger" ? p.error : p.inkSoft;
  const body = (
    <Row gap={12} style={[s.listRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border }]}>
      {I && (
        <View style={[s.rowIcon, { backgroundColor: tone === "accent" ? alpha(p.accent, 0.12) : p.well }]}>
          <I color={fg} size={18} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="h3" color={tone === "danger" ? p.error : p.ink} lines={1}>
          {title}
        </Txt>
        {meta ? (
          <Txt v="meta" lines={2}>
            {meta}
          </Txt>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight color={p.muted} size={18} /> : null)}
    </Row>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { backgroundColor: p.well }}>
      {body}
    </Pressable>
  );
}

export type Stat = { label: string; value: string | number; unit?: string; kicker?: string; foot?: string; footColor?: string; extra?: ReactNode };

/** A row of key numbers in one card, separated by hairlines. */
export function StatBand({ stats }: { stats: Stat[] }) {
  const p = usePalette();
  return (
    <Card padded={false} style={{ flexDirection: "row" }}>
      {stats.map((st, i) => (
        <View
          key={st.label}
          style={[{ flex: 1, padding: stats.length > 3 ? 10 : 14, gap: 4 }, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: p.border }]}
          accessible
          accessibilityLabel={`${st.label}: ${st.value} ${st.unit ?? ""}${st.kicker ? `, ${st.kicker}` : ""}`}
        >
          <Txt v="eyebrow" lines={1} style={{ fontSize: 10.5 }}>
            {st.label}
          </Txt>
          {st.kicker ? (
            <Txt v="meta" lines={1}>
              {st.kicker}
            </Txt>
          ) : null}
          <Row gap={4} style={{ alignItems: "baseline" }}>
            <Txt v="display" style={{ fontSize: 22 }} lines={1}>
              {st.value}
            </Txt>
            {st.unit ? <Txt v="meta">{st.unit}</Txt> : null}
          </Row>
          {st.extra}
          {st.foot ? (
            <Txt v="meta" color={st.footColor} lines={2} style={{ fontSize: 11.5 }}>
              {st.foot}
            </Txt>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

export function CoachCard({ text, cta, onPress }: { text: string; cta?: string; onPress?: () => void }) {
  const p = usePalette();
  return (
    <View style={[s.card, { padding: 16, gap: 10, borderColor: alpha(p.ai, 0.3), backgroundColor: alpha(p.ai, 0.07) }]}>
      <Row gap={6}>
        <Sparkles color={p.ai} size={15} />
        <Txt v="eyebrow" color={p.ai}>
          Coach
        </Txt>
      </Row>
      <Txt v="bodySm" color={p.ink}>
        {text}
      </Txt>
      {cta && onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
          <Txt v="label" color={p.ai}>
            {cta} →
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptySlot({ children, action }: { children: string; action?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={[s.empty, { borderColor: p.border }]}>
      <Txt v="bodySm" color={p.muted} style={{ textAlign: "center" }}>
        {children}
      </Txt>
      {action}
    </View>
  );
}

export function Badge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "accent" | "success" | "warning" | "ai" }) {
  const p = usePalette();
  const map = {
    neutral: [p.well, p.inkSoft],
    accent: [alpha(p.accentFill, 0.22), p.ink],
    success: [alpha(p.success, 0.14), p.success],
    warning: [alpha(p.warning, 0.14), p.warning],
    ai: [alpha(p.ai, 0.14), p.ai],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Txt v="meta" color={fg} style={{ fontFamily: font.semibold, fontSize: 11 }}>
        {children}
      </Txt>
    </View>
  );
}

// ---------- controls ----------

type ButtonVariant = "primary" | "volt" | "secondary" | "ghost" | "danger" | "glass";

function buttonColors(p: Palette, v: ButtonVariant): { bg: string; fg: string; border?: string } {
  switch (v) {
    case "primary":
    case "volt":
      return { bg: p.accentFill, fg: p.onAccent };
    case "secondary":
      return { bg: alpha(p.accent, 0.07), fg: p.accent, border: alpha(p.accent, 0.3) };
    case "ghost":
      return { bg: p.well, fg: p.ink };
    case "danger":
      return { bg: alpha(p.error, 0.1), fg: p.error };
    case "glass":
      return { bg: "rgba(255,255,255,0.1)", fg: "#FFFFFF" };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon: I,
  disabled,
  busy,
  small,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: Icon;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const c = buttonColors(p, variant);
  const big = variant === "volt";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={({ pressed }) => [
        s.btn,
        {
          backgroundColor: c.bg,
          borderColor: c.border ?? "transparent",
          borderWidth: c.border ? 1 : 0,
          minHeight: small ? 40 : big ? 56 : 48,
          borderRadius: big ? 18 : radius.control,
          paddingHorizontal: small ? 14 : 18,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        big && { shadowColor: p.volt, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {I && <I color={c.fg} size={small ? 15 : 18} fill={variant === "volt" && label.startsWith("Start") ? c.fg : "none"} />}
          <Text style={{ color: c.fg, fontFamily: font.semibold, fontSize: small ? 14 : 15.5 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Pill tabs for a small set of choices. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
  overlay,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  overlay?: boolean;
}) {
  const p = usePalette();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexDirection: "row", backgroundColor: overlay ? "rgba(255,255,255,0.08)" : p.well, borderRadius: 999, padding: 3 }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: overlay ? undefined : 1,
              minHeight: 38,
              paddingHorizontal: 12,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? (overlay ? p.volt : p.card) : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: on ? font.semibold : font.medium,
                fontSize: 13,
                color: on ? (overlay ? p.onVolt : p.ink) : overlay ? "rgba(255,255,255,0.75)" : p.inkSoft,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Big, glove-friendly − value + control. The value can also be typed. */
export function Stepper({
  label,
  value,
  step,
  onChange,
  unit,
  min = 0,
  decimals = 2,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  decimals?: number;
}) {
  const p = usePalette();
  const [text, setText] = useState(String(value));
  // Follow outside changes (the +/- buttons, a new set) without an effect.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  const round = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;
  const bump = (d: number) => onChange(Math.max(min, round(value + d)));
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Txt v="eyebrow" style={{ textAlign: "center" }}>
        {unit ? `${label} · ${unit}` : label}
      </Txt>
      <Row gap={6}>
        <StepBtn icon={Minus} label={`Decrease ${label}`} onPress={() => bump(-step)} />
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={() => {
            const n = parseFloat(text.replace(",", "."));
            if (Number.isFinite(n)) onChange(Math.max(min, round(n)));
            else setText(String(value));
          }}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={label}
          style={[s.num, { color: p.ink, backgroundColor: p.well, borderColor: p.border }]}
        />
        <StepBtn icon={Plus} label={`Increase ${label}`} onPress={() => bump(step)} />
      </Row>
    </View>
  );
}

function StepBtn({ icon: I, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.stepBtn, { backgroundColor: pressed ? p.border : p.well }]}
    >
      <I color={p.ink} size={20} />
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const p = usePalette();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="label" color={p.inkSoft}>{label}</Txt> : null}
      <TextInput
        placeholderTextColor={p.muted}
        accessibilityLabel={label ?? rest.placeholder}
        {...rest}
        style={[s.input, { color: p.ink, backgroundColor: p.well, borderColor: p.border }, style]}
      />
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: on ? alpha(p.accent, 0.5) : p.border,
        backgroundColor: on ? alpha(p.accentFill, 0.18) : p.well,
      }}
    >
      <Txt v="bodySm" color={on ? p.ink : p.inkSoft} style={on ? { fontFamily: font.semibold } : undefined}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Bottom sheet over a dimmed backdrop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { backgroundColor: p.card, paddingBottom: insets.bottom + 16, maxHeight: "88%" }]}>
          <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <Txt v="h2">{title}</Txt>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={s.close}>
              <X color={p.inkSoft} size={22} />
            </Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Renders src/lib/toast messages above the tab bar. */
export function ToastHost() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);
  if (!toasts.length) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 72, gap: 8 }}>
      {toasts.map((t) => (
        <View
          key={t.id}
          accessibilityLiveRegion="polite"
          style={{
            alignSelf: "center",
            backgroundColor: t.variant === "error" ? p.error : p.night,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 10,
            opacity: t.leaving ? 0 : 1,
          }}
        >
          <Text style={{ color: t.variant === "success" ? p.volt : "#FFFFFF", fontFamily: font.semibold, fontSize: 14 }}>{t.message}</Text>
        </View>
      ))}
    </View>
  );
}

export function Loading() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: p.bg }}>
      <ActivityIndicator color={p.accent} />
    </View>
  );
}

const s = StyleSheet.create({
  iconBtn: { width: 44, height: 44, borderRadius: radius.control, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", right: 8, top: 8, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  card: { borderRadius: radius.card, borderWidth: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  hero: { borderRadius: radius.sheet, padding: 20, overflow: "hidden" },
  glow: { position: "absolute", right: -40, top: -40, width: 170, height: 170, borderRadius: 85 },
  listRow: { paddingHorizontal: 16, paddingVertical: 13, minHeight: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.card, padding: 20, gap: 12, alignItems: "center" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  num: { flex: 1, minHeight: 52, borderRadius: radius.control, borderWidth: 1, textAlign: "center", fontFamily: font.bold, fontSize: 20 },
  stepBtn: { width: 52, height: 52, borderRadius: radius.control, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 50, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 14, fontFamily: font.regular, fontSize: 16 },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 20 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
});
