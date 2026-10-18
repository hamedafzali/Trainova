import * as THREE from "three";
import type { Muscle } from "@/domain/taxonomy";
import { anchorPoint, local, type Skeleton } from "@/motion/rig";
import type { Part, V3 } from "@/motion/types";
import { add, dist, mid, norm, rad, sub } from "@/motion/vec";

// Imperative three.js scene for the movement guide. The figure and every
// equipment part are generated from data; each exposes update(skeleton) so a
// frame is: solve the pose → update everything. No per-frame allocation of
// meshes, just transforms.

export const PALETTE = {
  body: "#C9CFD8",
  face: "#0A1119",
  primary: "#C3E201",
  secondary: "#8AA313",
  frame: "#4A5463",
  pad: "#262E3A",
  metal: "#AEB6C4",
  plate: "#1E252F",
  band: "#FF6B57",
  floor: "#141B25",
};

const v = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const tmp = new THREE.Vector3();

const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });

const MAT = {
  frame: std(PALETTE.frame, { metalness: 0.5, roughness: 0.45 }),
  pad: std(PALETTE.pad, { roughness: 0.85 }),
  metal: std(PALETTE.metal, { metalness: 0.85, roughness: 0.3 }),
  plate: std(PALETTE.plate, { metalness: 0.3, roughness: 0.55 }),
  band: std(PALETTE.band, { roughness: 0.7 }),
  cable: std("#6B7585", { metalness: 0.6, roughness: 0.4 }),
};

const GEO = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  hex: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** Places a unit cylinder between two points. */
function span(m: THREE.Object3D, a: V3, b: V3, r: number) {
  const d = tmp.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const l = d.length();
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  if (l > 1e-6) m.quaternion.setFromUnitVectors(Y, d.divideScalar(l));
  m.scale.set(r, Math.max(l, 1e-4), r);
}
const rod = (a: V3, b: V3, r: number, mat: THREE.Material) => {
  const m = mesh(GEO.cyl, mat);
  span(m, a, b, r);
  return m;
};
const block = (at: V3, size: V3, mat: THREE.Material, tilt = 0) => {
  const m = mesh(GEO.box, mat);
  m.position.copy(v(at));
  m.scale.copy(v(size));
  m.rotation.x = rad(tilt);
  return m;
};
/** Cylinder whose axis runs along X (bars, rollers, plates). */
const xRod = (len: number, r: number, mat: THREE.Material, geo = GEO.cyl) => {
  const m = mesh(geo, mat);
  m.rotation.z = Math.PI / 2;
  m.scale.set(r, len, r);
  return m;
};

// ── Figure ─────────────────────────────────────────────────────────────────

export { buildFigure, type Figure, type Highlight } from "./body";
type Level = 0 | 1 | 2;
type Highlight = Partial<Record<Muscle, Level>>;

/** Muscles shown on the figure, expanded for the catch-all groups. */
export function highlightFor(primary: Muscle | null | undefined, secondary: Muscle[] = []): Highlight {
  const h: Highlight = {};
  const set = (m: Muscle, l: Level) => (h[m] = Math.max(h[m] ?? 0, l) as Level);
  const expand = (m: Muscle, l: Level) => {
    if (m === "full body") for (const x of ["quads", "glutes", "chest", "shoulders", "abs", "upper back"] as Muscle[]) set(x, l);
    else if (m === "cardio") for (const x of ["quads", "hamstrings", "calves", "glutes"] as Muscle[]) set(x, l);
    else set(m, l);
  };
  for (const m of secondary) expand(m, 1);
  if (primary) expand(primary, 2);
  return h;
}

const mul3 = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

// ── Equipment ──────────────────────────────────────────────────────────────

export interface Built {
  object: THREE.Object3D;
  update?(sk: Skeleton): void;
}

/** Posts from a height down to the floor with a small foot. */
function post(x: number, z: number, h: number, mat = MAT.frame, w = 0.06) {
  return block([x, h / 2, z], [w, h, w], mat);
}

function barbell(style: "straight" | "ez" | "trap", length: number, plates: boolean): Built {
  const g = new THREE.Group();
  if (style === "trap") {
    const r = 0.36;
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const a1 = ((k + 1) / 6) * Math.PI * 2 + Math.PI / 6;
      g.add(rod([Math.cos(a0) * r, 0, Math.sin(a0) * r * 1.15], [Math.cos(a1) * r, 0, Math.sin(a1) * r * 1.15], 0.018, MAT.metal));
    }
    for (const s of [1, -1]) {
      g.add(rod([s * 0.27, 0, -0.1], [s * 0.27, 0, 0.1], 0.017, MAT.metal));
      g.add(rod([s * 0.36, 0, 0], [s * 0.95, 0, 0], 0.025, MAT.metal));
      if (plates) {
        const p = xRod(0.06, 0.225, MAT.plate);
        p.position.x = s * 0.62;
        g.add(p);
      }
    }
  } else {
    const shaft = xRod(length, 0.014, MAT.metal);
    g.add(shaft);
    const big = length >= 1.8;
    const sleeve = big ? 0.42 : 0.2;
    for (const s of [1, -1]) {
      const sl = xRod(sleeve, 0.025, MAT.metal);
      sl.position.x = s * (length / 2 - sleeve / 2);
      g.add(sl);
      if (plates) {
        const p = xRod(big ? 0.06 : 0.04, big ? 0.225 : 0.12, MAT.plate);
        p.position.x = s * (length / 2 - sleeve + (big ? 0.06 : 0.04));
        g.add(p);
      }
      if (style === "ez") {
        const k = xRod(0.05, 0.02, MAT.metal);
        k.position.x = s * 0.12;
        g.add(k);
      }
    }
  }
  return {
    object: g,
    update(sk) {
      const c = mid(sk.hand[0], sk.hand[1]);
      g.position.copy(v(c));
      if (style === "trap") {
        // Handles stay level; the frame turns with the body.
        g.rotation.set(0, Math.atan2(sk.frame.fwd[0], sk.frame.fwd[2]), 0);
        return;
      }
      const d = v(sub(sk.hand[0], sk.hand[1]));
      if (d.length() < 0.05) d.copy(X);
      g.quaternion.setFromUnitVectors(X, d.normalize());
    },
  };
}

function dumbbell(to: "handL" | "handR" | "hands"): Built {
  const g = new THREE.Group();
  g.add(xRod(0.14, 0.016, MAT.metal));
  for (const s of [1, -1]) {
    const h = xRod(0.07, 0.058, MAT.plate, GEO.hex);
    h.position.x = s * 0.1;
    g.add(h);
  }
  return {
    object: g,
    update(sk) {
      const i = to === "handR" ? 1 : 0;
      const hand = to === "hands" ? mid(sk.hand[0], sk.hand[1]) : sk.hand[i];
      g.position.copy(v(hand));
      let axis: THREE.Vector3;
      if (to === "hands") axis = v(sub(sk.hand[0], sk.elbow[0])).add(v(sub(sk.hand[1], sk.elbow[1]))).normalize();
      else {
        // Across the palm: sideways, kept perpendicular to the forearm.
        const fore = v(sub(sk.hand[i], sk.elbow[i])).normalize();
        axis = v(sk.frame.left).addScaledVector(fore, -v(sk.frame.left).dot(fore));
        if (axis.length() < 0.1) axis = new THREE.Vector3(0, 0, 1);
        axis.normalize();
      }
      g.quaternion.setFromUnitVectors(X, axis);
    },
  };
}

function kettlebell(to: Part & { kind: "kettlebell" }): Built {
  const g = new THREE.Group();
  const bell = mesh(GEO.sphere, MAT.plate);
  bell.scale.setScalar(0.1);
  bell.position.y = -0.13;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 8, 20, Math.PI), MAT.plate);
  handle.position.y = -0.06;
  handle.castShadow = true;
  g.add(bell, handle);
  return {
    object: g,
    update(sk) {
      g.position.copy(v(add(anchorPoint(sk, to.to), to.offset ?? [0, 0, 0])));
      g.rotation.y = Math.atan2(sk.frame.fwd[0], sk.frame.fwd[2]);
    },
  };
}

function cable(p: Part & { kind: "cable" }): Built {
  const g = new THREE.Group();
  const from = p.from;
  const wire = mesh(GEO.cyl, MAT.cable, false);
  const wireL = mesh(GEO.cyl, MAT.cable, false);
  const wireR = mesh(GEO.cyl, MAT.cable, false);
  g.add(wire);
  const pulley = xRod(0.03, 0.05, MAT.metal);
  pulley.position.copy(v(from));
  g.add(pulley);
  if (p.tower) {
    // The column stands just behind the pulley, away from the user.
    const out = new THREE.Vector3(from[0], 0, from[2]);
    if (out.length() < 0.05) out.set(0, 0, 1);
    out.normalize().multiplyScalar(0.1);
    const x = from[0] + out.x;
    const z = from[2] + out.z;
    const top = Math.max(2.2, from[1] + 0.1);
    g.add(post(x, z, top, MAT.frame, 0.08));
    g.add(block([x, 0.3, z + out.z * 1.5], [0.22, 0.5, 0.12], MAT.plate));
    g.add(block([x, 0.02, z], [0.4, 0.04, 0.4], MAT.frame));
  }
  const bar = xRod(1, 0.014, MAT.metal);
  const grip = mesh(GEO.cyl, MAT.pad);
  if (p.handle === "bar") g.add(bar);
  if (p.handle === "single") g.add(grip);
  if (p.handle === "rope") g.add(wireL, wireR);
  return {
    object: g,
    update(sk) {
      const both = p.to === "hands";
      const hands = both ? mid(sk.hand[0], sk.hand[1]) : anchorPoint(sk, p.to);
      const attach: V3 = p.handle === "rope" ? add(hands, mul3(norm(sub(from, hands)), 0.14)) : hands;
      span(wire, from, attach, 0.006);
      if (p.handle === "bar") {
        const d = v(sub(sk.hand[0], sk.hand[1]));
        const w = Math.max(d.length() + 0.18, 0.45);
        bar.position.copy(v(hands));
        bar.quaternion.setFromUnitVectors(X, d.length() < 0.05 ? X.clone() : d.normalize());
        bar.scale.set(0.014, w, 0.014);
      }
      if (p.handle === "single") span(grip, add(hands, [0, -0.06, 0]), add(hands, [0, 0.06, 0]), 0.02);
      if (p.handle === "rope") {
        span(wireL, attach, sk.hand[0], 0.012);
        span(wireR, attach, sk.hand[1], 0.012);
      }
    },
  };
}

function lever(p: Part & { kind: "lever" }): Built {
  const g = new THREE.Group();
  const arm = mesh(GEO.cyl, MAT.frame);
  const hub = xRod(0.08, 0.04, MAT.metal);
  hub.position.copy(v(p.pivot));
  g.add(arm, hub);
  const end = p.end ?? "handle";
  const width = p.width ?? 0;
  const tip =
    end === "roller"
      ? xRod(width || 0.36, 0.05, MAT.pad)
      : end === "pad"
        ? mesh(GEO.box, MAT.pad)
        : end === "handle"
          ? width
            ? xRod(width, 0.016, MAT.metal)
            : mesh(GEO.cyl, MAT.pad)
          : null;
  if (tip) g.add(tip);
  if (end === "pad" && tip) tip.scale.set(0.24, 0.06, 0.2);
  return {
    object: g,
    update(sk) {
      const at = add(anchorPoint(sk, p.to), p.offset ?? [0, 0, 0]);
      span(arm, p.pivot, at, 0.024);
      if (!tip) return;
      if (end === "handle" && !width) span(tip, add(at, [0, -0.065, 0]), add(at, [0, 0.065, 0]), 0.02);
      else tip.position.copy(v(at));
    },
  };
}

function bench(p: Part & { kind: "bench" }): Built {
  const g = new THREE.Group();
  const at = p.at ?? [0, 0.46, 0.08];
  const inc = rad(p.incline ?? 0);
  const L = p.length ?? 0.95;
  const t = 0.07;
  g.add(block([at[0], at[1] - t / 2, at[2] + 0.18], [0.3, t, 0.38], MAT.pad));
  const d: V3 = [0, Math.sin(inc), -Math.cos(inc)];
  const n: V3 = [0, Math.cos(inc), Math.sin(inc)];
  const c = add(add(at, mul3(d, L / 2)), mul3(n, -t / 2));
  const back = block(c, [0.3, t, L], MAT.pad);
  back.rotation.x = inc;
  g.add(back);
  // Frame: a spine along the floor and two posts.
  const lowY = at[1] - t - 0.03;
  g.add(post(at[0], at[2] + 0.22, lowY, MAT.frame, 0.07));
  const backMid = add(at, mul3(d, Math.min(L * 0.6, 0.5)));
  g.add(rod([at[0], 0, backMid[2]], add(backMid, mul3(n, -t)), 0.03, MAT.frame));
  g.add(block([at[0], 0.03, (at[2] + 0.22 + backMid[2]) / 2], [0.07, 0.06, Math.abs(at[2] + 0.22 - backMid[2]) + 0.3], MAT.frame));
  return { object: g };
}

function seat(p: Part & { kind: "seat" }): Built {
  const g = new THREE.Group();
  const at = p.at;
  const w = p.width ?? 0.42;
  g.add(block([at[0], at[1] - 0.035, at[2] + 0.08], [w, 0.07, 0.4], MAT.pad));
  g.add(post(at[0], at[2] + 0.05, at[1] - 0.07, MAT.frame, 0.07));
  g.add(block([at[0], 0.02, at[2]], [0.5, 0.04, 0.7], MAT.frame));
  if (p.back !== undefined) {
    const b = rad(p.back);
    const up: V3 = [0, Math.cos(b), -Math.sin(b)];
    const c = add([at[0], at[1], at[2] - 0.15], mul3(up, 0.34));
    const pad = block(c, [w, 0.62, 0.07], MAT.pad);
    pad.rotation.x = -b;
    g.add(pad);
    g.add(rod([at[0], at[1] - 0.07, at[2] - 0.05], add(c, [0, 0, -0.06]), 0.03, MAT.frame));
  }
  return { object: g };
}

function pad(p: Part & { kind: "pad" }): Built {
  const m = p.roller ? xRod(p.size[0], p.size[1] / 2 + 0.01, MAT.pad) : mesh(GEO.box, MAT.pad);
  if (!p.roller) m.scale.copy(v(p.size));
  return {
    object: m,
    update(sk) {
      m.position.copy(v(add(anchorPoint(sk, p.to), p.offset ?? [0, 0, 0])));
      if (!p.roller) {
        m.rotation.set(rad(p.tilt ?? 0), Math.atan2(sk.frame.fwd[0], sk.frame.fwd[2]), 0);
      }
    },
  };
}

function frameGroup(...parts: THREE.Object3D[]): Built {
  const g = new THREE.Group();
  g.add(...parts);
  return { object: g };
}

export function buildPart(p: Part): Built {
  switch (p.kind) {
    case "bench":
      return bench(p);
    case "seat":
      return seat(p);
    case "box":
      return { object: block(p.at, p.size, MAT[p.tone ?? "frame"], p.tilt) };
    case "pad":
      return pad(p);
    case "barbell":
      return barbell(p.style ?? "straight", p.length ?? 2.0, p.plates ?? true);
    case "dumbbell":
      return dumbbell(p.to);
    case "kettlebell":
      return kettlebell(p);
    case "cable":
      return cable(p);
    case "lever":
      return lever(p);
    case "platform": {
      const m = mesh(GEO.box, MAT.metal);
      m.scale.set(0.72, 0.62, 0.035);
      m.rotation.x = rad(p.tilt);
      return { object: m, update: (sk) => m.position.copy(v(add(anchorPoint(sk, p.to), p.offset ?? [0, 0, 0]))) };
    }
    case "rack": {
      const w = (p.width ?? 1.2) / 2;
      const z = p.z ?? -0.1;
      const parts: THREE.Object3D[] = [];
      for (const s of [1, -1]) {
        parts.push(post(s * w, z, 2.25, MAT.frame, 0.07), block([s * w, 0.02, z], [0.1, 0.04, 0.7], MAT.frame));
        parts.push(block([s * (w - 0.02), p.height - 0.03, z + 0.07], [0.05, 0.05, 0.12], MAT.metal));
      }
      parts.push(block([0, 2.22, z], [w * 2, 0.06, 0.06], MAT.frame));
      return frameGroup(...parts);
    }
    case "smith": {
      const z = p.z ?? 0;
      const parts: THREE.Object3D[] = [];
      for (const s of [1, -1]) {
        parts.push(post(s * 0.82, z, 2.3, MAT.frame, 0.08), rod([s * 0.74, 0.05, z], [s * 0.74, 2.25, z], 0.012, MAT.metal));
        parts.push(block([s * 0.82, 0.02, z], [0.12, 0.04, 0.9], MAT.frame));
      }
      parts.push(block([0, 2.28, z], [1.72, 0.07, 0.08], MAT.frame));
      return frameGroup(...parts);
    }
    case "pullupBar": {
      const z = p.z ?? 0.04;
      const bar = xRod(1.3, 0.016, MAT.metal);
      bar.position.set(0, p.height, z);
      const parts: THREE.Object3D[] = [bar];
      for (const s of [1, -1]) parts.push(post(s * 0.66, z, p.height + 0.1, MAT.frame, 0.07), block([s * 0.66, 0.02, z], [0.1, 0.04, 0.8], MAT.frame));
      return frameGroup(...parts);
    }
    case "dipBars": {
      const z = p.z ?? 0.05;
      const parts: THREE.Object3D[] = [];
      for (const s of [1, -1]) {
        parts.push(rod([s * 0.27, p.height, z - 0.25], [s * 0.27, p.height, z + 0.35], 0.02, MAT.metal));
        parts.push(post(s * 0.33, z - 0.25, p.height, MAT.frame, 0.06), post(s * 0.33, z + 0.35, p.height, MAT.frame, 0.06));
        parts.push(rod([s * 0.27, p.height, z - 0.25], [s * 0.33, p.height, z - 0.25], 0.02, MAT.frame));
        parts.push(rod([s * 0.27, p.height, z + 0.35], [s * 0.33, p.height, z + 0.35], 0.02, MAT.frame));
      }
      return frameGroup(...parts);
    }
    case "stack": {
      const [x, , z] = p.at;
      return frameGroup(
        post(x - 0.16, z, 1.9, MAT.frame, 0.06),
        post(x + 0.16, z, 1.9, MAT.frame, 0.06),
        block([x, 1.9, z], [0.4, 0.06, 0.12], MAT.frame),
        block([x, 0.3, z], [0.26, 0.5, 0.14], MAT.plate),
        rod([x, 0.55, z], [x, 1.6, z], 0.01, MAT.metal)
      );
    }
    case "band": {
      const m = mesh(GEO.cyl, MAT.band);
      return { object: m, update: (sk) => span(m, sk.hand[0], sk.hand[1], 0.012) };
    }
    case "treadmill":
      return frameGroup(
        block([0, 0.085, -0.05], [0.82, 0.17, 1.8], MAT.frame),
        block([0, 0.172, -0.05], [0.56, 0.006, 1.68], MAT.pad),
        rod([0.36, 0.17, 0.78], [0.36, 1.25, 0.66], 0.03, MAT.frame),
        rod([-0.36, 0.17, 0.78], [-0.36, 1.25, 0.66], 0.03, MAT.frame),
        block([0, 1.3, 0.68], [0.8, 0.12, 0.2], MAT.plate),
        rod([0.36, 1.12, 0.66], [0.36, 1.12, 0.25], 0.02, MAT.metal),
        rod([-0.36, 1.12, 0.66], [-0.36, 1.12, 0.25], 0.02, MAT.metal)
      );
    case "bike": {
      const fly = xRod(0.05, 0.25, MAT.plate);
      fly.position.set(0, 0.42, 0.72);
      return frameGroup(
        block([0, 0.81, -0.08], [0.2, 0.06, 0.28], MAT.pad),
        rod([0, 0.78, -0.06], [0, 0.36, 0.3], 0.03, MAT.frame),
        rod([0, 0.36, 0.33], [0, 1.0, 0.52], 0.035, MAT.frame),
        rod([0.2, 1.02, 0.5], [-0.2, 1.02, 0.5], 0.018, MAT.metal),
        rod([0.13, 0.36, 0.33], [-0.13, 0.36, 0.33], 0.02, MAT.metal),
        fly,
        block([0, 0.03, 0.3], [0.5, 0.06, 1.2], MAT.frame)
      );
    }
    case "rower": {
      const fly = mesh(GEO.cyl, MAT.plate);
      fly.position.set(0, 0.5, 1.05);
      fly.rotation.z = Math.PI / 2;
      fly.scale.set(0.24, 0.16, 0.24);
      return frameGroup(
        block([0, 0.2, -0.15], [0.12, 0.08, 2.3], MAT.frame),
        block([0.12, 0.27, 0.36], [0.13, 0.03, 0.3], MAT.metal, -55),
        block([-0.12, 0.27, 0.36], [0.13, 0.03, 0.3], MAT.metal, -55),
        fly,
        post(0, -1.2, 0.2, MAT.frame, 0.06),
        post(0, 0.95, 0.3, MAT.frame, 0.08)
      );
    }
    case "elliptical":
      return frameGroup(
        block([0, 0.06, 0.05], [0.5, 0.12, 1.5], MAT.frame),
        rod([0, 0.1, 0.6], [0, 1.35, 0.55], 0.04, MAT.frame),
        block([0, 1.4, 0.55], [0.36, 0.1, 0.16], MAT.plate)
      );
    case "stairs":
      return frameGroup(
        block([0, 0.08, 0.05], [0.7, 0.16, 0.9], MAT.frame),
        rod([0, 0.16, 0.5], [0, 1.4, 0.45], 0.045, MAT.frame),
        block([0, 1.42, 0.45], [0.42, 0.12, 0.16], MAT.plate),
        rod([0.3, 1.32, 0.45], [0.3, 1.32, -0.05], 0.02, MAT.metal),
        rod([-0.3, 1.32, 0.45], [-0.3, 1.32, -0.05], 0.02, MAT.metal)
      );
  }
}
