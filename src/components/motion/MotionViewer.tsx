"use client";

import { Pause, Play } from "lucide-react";
import { motionSpecFor } from "pixelwizards-gym-motion";
import { GymMotion, type GymViewer } from "pixelwizards-gym-motion/react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import type { Exercise } from "@/domain/types";

// Interactive 3D movement guide, drawn by the pixelwizards-gym-motion package.
// The package owns the body, machines, camera and drag-to-orbit; this file only
// adds Trainova's controls and labels around it.

const VIEWS = [
  { key: "front", label: "Front" },
  { key: "angle", label: "3/4" },
  { key: "side", label: "Side" },
] as const;
type View = (typeof VIEWS)[number]["key"];

type Props = {
  exercise: Pick<Exercise, "id" | "name" | "equipment" | "primaryMuscle" | "secondaryMuscles">;
  /** Hero mode: no rounded frame or control bar, just the figure and a play/pause button. */
  bare?: boolean;
};

export default function MotionViewer({ exercise, bare = false }: Props) {
  const spec = useMemo(() => motionSpecFor(exercise), [exercise]);
  const [view, setView] = useState<View>("angle");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [cue, setCue] = useState("");
  // Tempo label only makes sense for rep-based moves, not holds or cardio.
  const [repSeconds, setRepSeconds] = useState<number | null>(null);
  const onReady = (v: GymViewer | null) => {
    v?.ready.then(() => setRepSeconds(v.repSeconds));
  };

  return (
    <div className={`select-none overflow-hidden bg-night ${bare ? "" : "rounded-card"}`}>
      <div className={`relative w-full ${bare ? "aspect-[16/10]" : "aspect-[4/3] sm:aspect-[16/10]"}`}>
        <GymMotion
          exercise={exercise}
          playing={playing}
          speed={speed}
          view={view}
          onCue={setCue}
          onReady={onReady}
          label={`Animated 3D guide showing how to do ${exercise.name}${spec.device ? ` on the ${spec.device.toLowerCase()}` : ""}. Drag sideways to turn the view.`}
          className="cursor-grab active:cursor-grabbing"
          // Inline, because the package sets an inline position: relative that would beat a class.
          style={{ position: "absolute", inset: 0 }}
        />

        {cue && (
          <p
            aria-live="polite"
            className="pointer-events-none absolute left-3 top-3 rounded-full bg-night/70 px-3 py-1 font-display text-sm uppercase tracking-wide text-volt backdrop-blur"
          >
            {cue}
          </p>
        )}
        {spec.device && (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-night/70 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
            {spec.device}
          </p>
        )}
        {repSeconds !== null && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-night/70 px-2.5 py-1 text-[11px] font-semibold text-white/70 backdrop-blur">
            {repSeconds.toFixed(1)}s / rep
          </p>
        )}
        {bare && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={playing ? "Pause animation" : "Play animation"}
            className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-night/70 text-white backdrop-blur"
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>

      {!bare && (
        <div className="flex items-center justify-between gap-2 border-t border-white/10 p-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause animation" : "Play animation"}
              className="grid h-11 w-11 place-items-center rounded-full bg-volt text-night"
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}
              aria-label={`Speed ${speed === 1 ? "normal" : "half"}; switch to ${speed === 1 ? "half" : "normal"} speed`}
              className="h-11 min-w-11 rounded-full px-2 text-xs font-bold text-white/85 hover:text-white"
            >
              {speed === 1 ? "1×" : "½×"}
            </button>
          </div>
          <Segmented variant="overlay" label="Camera angle" options={VIEWS} value={view} onChange={setView} />
        </div>
      )}
    </div>
  );
}
