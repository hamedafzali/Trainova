// The 3D movement guide in a WebView: the same pixelwizards-gym-motion viewer
// as the web app, bundled into one offline page (src/guide/guideHtml.ts). The
// app drives it through window.guide.* and hears cues and errors back.
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Pause, Play } from "lucide-react-native";
import type { Exercise } from "@/domain/types";
import { GUIDE_HTML } from "~/guide/guideHtml";
import { Segmented, Txt } from "~/ui/kit";
import { font, radius, usePalette } from "~/ui/theme";

const VIEWS = [
  { key: "front", label: "Front" },
  { key: "angle", label: "3/4" },
  { key: "side", label: "Side" },
] as const;
type View3d = (typeof VIEWS)[number]["key"];

// The package types default the extra-props parameter to `undefined`, and
// `Props & undefined` is `never` under TS 6, so pin it to an empty object.
const Web = WebView<object>;

type Msg = { type: "ready"; repSeconds: number | null } | { type: "cue"; cue: string } | { type: "error"; message: string };

export function GuideView({
  exercise,
  bare = false,
}: {
  exercise: Pick<Exercise, "id" | "name" | "equipment" | "primaryMuscle" | "secondaryMuscles">;
  /** Hero mode: no control bar, just the figure and a play/pause button. */
  bare?: boolean;
}) {
  const p = usePalette();
  const web = useRef<WebView<object>>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<View3d>("angle");
  const [cue, setCue] = useState("");
  const [repSeconds, setRepSeconds] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  // Options are fixed when the page loads; later changes go through window.guide.
  const boot = useMemo(
    () =>
      `window.__GUIDE__ = ${JSON.stringify({
        exercise: {
          id: exercise.id,
          name: exercise.name,
          equipment: exercise.equipment,
          primaryMuscle: exercise.primaryMuscle,
          secondaryMuscles: exercise.secondaryMuscles,
        },
        view: "angle",
        label: `Animated 3D guide showing how to do ${exercise.name}`,
      })}; true;`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise.id],
  );

  const send = (js: string) => web.current?.injectJavaScript(`${js}; true;`);
  const togglePlay = () => {
    send(`window.guide.play(${!playing})`);
    setPlaying(!playing);
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: Msg;
    try {
      msg = JSON.parse(e.nativeEvent.data) as Msg;
    } catch {
      return;
    }
    if (msg.type === "cue") setCue(msg.cue);
    else if (msg.type === "ready") setRepSeconds(msg.repSeconds ?? null);
    else if (msg.type === "error") setFailed(true);
  };

  if (failed)
    return (
      <View style={{ backgroundColor: p.night, borderRadius: radius.card, padding: 24 }}>
        <Txt v="bodySm" color="rgba(255,255,255,0.7)" style={{ textAlign: "center" }}>
          3D preview isn’t available on this device.
        </Txt>
      </View>
    );

  return (
    <View style={{ backgroundColor: p.night, borderRadius: bare ? 0 : radius.card, overflow: "hidden" }}>
      <View style={{ width: "100%", aspectRatio: bare ? 16 / 10 : 4 / 3 }}>
        <Web
          ref={web}
          key={exercise.id}
          originWhitelist={["*"]}
          source={{ html: GUIDE_HTML }}
          injectedJavaScriptBeforeContentLoaded={boot}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          style={{ flex: 1, backgroundColor: "#141B25" }}
          accessibilityLabel={`Animated 3D guide showing how to do ${exercise.name}. Drag sideways to turn the view.`}
        />
        {cue ? <Pill style={{ left: 12, top: 12 }} color={p.volt} text={cue.toUpperCase()} /> : null}
        {repSeconds != null ? <Pill style={{ right: 12, top: 12 }} color="rgba(255,255,255,0.75)" text={`${repSeconds.toFixed(1)}s / rep`} /> : null}
        {bare ? (
          <Pressable
            onPress={togglePlay}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause animation" : "Play animation"}
            style={{ position: "absolute", right: 12, bottom: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(10,17,25,0.7)", alignItems: "center", justifyContent: "center" }}
          >
            {playing ? <Pause color="#FFFFFF" size={18} /> : <Play color="#FFFFFF" size={18} />}
          </Pressable>
        ) : null}
      </View>
      {!bare ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Pressable
              onPress={togglePlay}
              accessibilityRole="button"
              accessibilityLabel={playing ? "Pause animation" : "Play animation"}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.volt, alignItems: "center", justifyContent: "center" }}
            >
              {playing ? <Pause color={p.onVolt} size={18} /> : <Play color={p.onVolt} size={18} />}
            </Pressable>
            <Pressable
              onPress={() => {
                const s = speed === 1 ? 0.5 : 1;
                send(`window.guide.speed(${s})`);
                setSpeed(s);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Speed ${speed === 1 ? "normal" : "half"}; switch to ${speed === 1 ? "half" : "normal"} speed`}
              style={{ minWidth: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: font.bold, fontSize: 13 }}>{speed === 1 ? "1×" : "½×"}</Text>
            </Pressable>
          </View>
          <Segmented
            overlay
            label="Camera angle"
            options={VIEWS}
            value={view}
            onChange={(v) => {
              send(`window.guide.view(${JSON.stringify(v)})`);
              setView(v);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function Pill({ text, color, style }: { text: string; color: string; style: { left?: number; right?: number; top?: number } }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", backgroundColor: "rgba(10,17,25,0.7)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }, style]}>
      <Text style={{ color, fontFamily: font.semibold, fontSize: 12, letterSpacing: 0.4 }}>{text}</Text>
    </View>
  );
}
