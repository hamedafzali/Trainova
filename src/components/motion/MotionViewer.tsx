"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Muscle } from "@/domain/taxonomy";
import type { Exercise } from "@/domain/types";
import { motionSpecFor, resolveMotion } from "@/motion/catalog";
import { solve } from "@/motion/rig";
import { cycleLength, sample } from "@/motion/timeline";
import type { Motion, MotionSpec } from "@/motion/types";
import {
  buildFigure,
  buildPart,
  highlightFor,
  PALETTE,
  type Highlight,
} from "./scene";

// Interactive 3D movement guide. One engine for every exercise: the catalog
// turns the exercise into data, the rig solves each frame, the scene draws it.

const VIEWS = [
  { key: "front", label: "Front", yaw: 0 },
  { key: "angle", label: "3/4", yaw: null },
  { key: "side", label: "Side", yaw: 90 },
] as const;
const DEFAULT_YAW = 50;
const FOV = 30;

type Props = {
  exercise: Pick<
    Exercise,
    "id" | "name" | "equipment" | "primaryMuscle" | "secondaryMuscles"
  >;
};

/** Centre and radius that contain every key pose, for framing the camera. */
function framing(m: Motion) {
  const box = new THREE.Box3();
  for (const k of m.keys) {
    const sk = solve(k);
    for (const p of [
      sk.head,
      sk.pelvis,
      ...sk.hand,
      ...sk.elbow,
      ...sk.knee,
      ...sk.toe,
      ...sk.ankle,
    ])
      box.expandByPoint(new THREE.Vector3(...p));
  }
  box.expandByPoint(new THREE.Vector3(box.min.x, 0, box.min.z)); // keep the floor contact in view
  box.expandByScalar(0.16);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return { centre, radius: Math.max(size.length() / 2, 0.6) };
}

function Scene({
  spec,
  highlight,
  timeRef,
  playing,
  speed,
  yawRef,
  onCue,
}: {
  spec: MotionSpec;
  highlight: Highlight;
  timeRef: React.MutableRefObject<number>;
  playing: boolean;
  speed: number;
  yawRef: React.MutableRefObject<number>;
  onCue: (cue: string) => void;
}) {
  const { camera, gl, scene } = useThree();
  const { motion, equipment } = useMemo(() => resolveMotion(spec), [spec]);
  const figure = useMemo(() => buildFigure(highlight), [highlight]);
  const parts = useMemo(() => equipment.map(buildPart), [equipment]);
  const frame = useMemo(() => framing(motion), [motion]);
  const lastCue = useRef("");
  const yaw = useRef(yawRef.current);

  useEffect(() => () => figure.dispose(), [figure]);

  // Soft studio reflections so the body reads as rounded, not flat.
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.2;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useFrame(({ invalidate }, delta) => {
    if (playing) timeRef.current += Math.min(delta, 0.1) * speed;
    const f = sample(motion, timeRef.current, spec.tempo);
    const sk = solve(f.pose);
    figure.update(sk, f.working ? Math.sin(Math.PI * Math.min(1, f.phase)) : 0);
    for (const p of parts) p.update?.(sk);
    if (f.cue !== lastCue.current) {
      lastCue.current = f.cue;
      onCue(f.cue);
    }
    // Ease the orbit towards the requested angle.
    yaw.current += (yawRef.current - yaw.current) * Math.min(1, delta * 8);
    // On-demand rendering (paused): keep drawing until the orbit settles.
    if (Math.abs(yawRef.current - yaw.current) > 0.05) invalidate();
    const pitch = THREE.MathUtils.degToRad(spec.camera?.pitch ?? 14);
    const y = THREE.MathUtils.degToRad(yaw.current);
    const d =
      (frame.radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) *
      (spec.camera?.zoom ?? 1) *
      1.02;
    camera.position.set(
      frame.centre.x + d * Math.sin(y) * Math.cos(pitch),
      frame.centre.y + d * Math.sin(pitch),
      frame.centre.z + d * Math.cos(y) * Math.cos(pitch),
    );
    camera.lookAt(frame.centre);
  });

  return (
    <>
      <hemisphereLight args={["#E4E8FF", "#1E2448", 0.4]} />
      <directionalLight
        position={[-2.6, 4, 2.2]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={4}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
        shadow-bias={-0.0004}
      />
      <directionalLight
        position={[2.8, 2.2, -2.6]}
        intensity={0.7}
        color="#B8C4FF"
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[2.4, 48]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.95} />
      </mesh>
      <primitive object={figure.group} />
      {parts.map((p, i) => (
        <primitive key={i} object={p.object} />
      ))}
    </>
  );
}

export default function MotionViewer({ exercise }: Props) {
  const spec = useMemo(() => motionSpecFor(exercise), [exercise]);
  const highlight = useMemo(
    () =>
      highlightFor(
        exercise.primaryMuscle as Muscle | null,
        exercise.secondaryMuscles,
      ),
    [exercise.primaryMuscle, exercise.secondaryMuscles],
  );
  const angleYaw = spec.camera?.yaw ?? DEFAULT_YAW;
  const wrap = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const yawRef = useRef(angleYaw);
  const [view, setView] = useState<(typeof VIEWS)[number]["key"] | null>(
    "angle",
  );
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [cue, setCue] = useState("");
  const [visible, setVisible] = useState(false);
  const invalidate = useRef<() => void>(() => {});

  // Respect reduced motion: start paused at the working end of the rep.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const { motion } = resolveMotion(spec);
      timeRef.current =
        motion.kind === "rep" ? (spec.tempo ?? motion.tempo ?? [1.2])[0] : 0;
      setPlaying(false);
    }
  }, [spec]);

  // Only render while on screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined")
      return setVisible(true);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "100px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const setYaw = (y: number, v: typeof view) => {
    yawRef.current = y;
    setView(v);
    invalidate.current();
  };

  // Horizontal drag orbits; vertical drags still scroll the page (touch-action: pan-y).
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, yaw: yawRef.current };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    yawRef.current = drag.current.yaw - (e.clientX - drag.current.x) * 0.5;
    setView(null);
    invalidate.current();
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };

  // Tempo label only makes sense for rep-based moves, not holds or cardio.
  const repSeconds = useMemo(() => {
    const m = resolveMotion(spec).motion;
    return m.kind === "rep" ? cycleLength(m, spec.tempo) : null;
  }, [spec]);
  const frameloop = !visible
    ? "never"
    : playing || dragging
      ? "always"
      : "demand";

  return (
    <div
      ref={wrap}
      className="select-none overflow-hidden rounded-card bg-night"
    >
      <div
        className="relative aspect-[4/3] w-full cursor-grab touch-pan-y active:cursor-grabbing sm:aspect-[16/10]"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          role="img"
          aria-label={`Animated 3D guide showing how to do ${exercise.name}${spec.device ? ` on the ${spec.device.toLowerCase()}` : ""}. Drag sideways to turn the view.`}
          className="absolute inset-0"
        >
          <Canvas
            shadows="soft"
            dpr={[1, 2]}
            frameloop={frameloop}
            camera={{ fov: FOV, near: 0.05, far: 30, position: [3, 1.5, 3] }}
            gl={{ antialias: true, powerPreference: "low-power" }}
            onCreated={(s) => {
              s.gl.setClearColor(PALETTE.face);
              invalidate.current = s.invalidate;
            }}
          >
            <Scene
              spec={spec}
              highlight={highlight}
              timeRef={timeRef}
              playing={playing}
              speed={speed}
              yawRef={yawRef}
              onCue={setCue}
            />
          </Canvas>
        </div>

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
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 p-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setPlaying((p) => !p);
              invalidate.current();
            }}
            aria-label={playing ? "Pause animation" : "Play animation"}
            className="grid h-11 w-11 place-items-center rounded-full bg-volt text-night"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
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
        <div
          role="radiogroup"
          aria-label="Camera angle"
          className="flex gap-1 rounded-full bg-white/5 p-1"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={view === v.key}
              onClick={() => setYaw(v.yaw ?? angleYaw, v.key)}
              className={`h-11 min-w-11 rounded-full px-3 text-xs font-semibold transition-colors ${
                view === v.key
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
