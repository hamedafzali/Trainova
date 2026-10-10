// Stylised front/back body figures built from simple shapes, one or more per
// muscle. Shared by the on-screen readiness map (React) and the share-image
// recap (SVG string), so both always draw the same body. Each figure lives in a
// 100 × 200 box; the back figure is drawn at x + BACK_OFFSET.

import type { Muscle } from "@/domain/taxonomy";

export type BodyShape =
  | { m: Muscle | null; t: "e"; cx: number; cy: number; rx: number; ry: number }
  | { m: Muscle | null; t: "r"; x: number; y: number; w: number; h: number; r: number }
  | { m: Muscle | null; t: "p"; d: string };

export const BODY_VIEWBOX = "0 0 220 200";
export const BACK_OFFSET = 120;

/** Both sides of the body: mirror a left-side shape around x = 50. */
function pair(s: BodyShape): BodyShape[] {
  if (s.t === "e") return [s, { ...s, cx: 100 - s.cx }];
  if (s.t === "r") return [s, { ...s, x: 100 - s.x - s.w }];
  return [s];
}
const e = (m: Muscle | null, cx: number, cy: number, rx: number, ry: number): BodyShape => ({ m, t: "e", cx, cy, rx, ry });
const r = (m: Muscle | null, x: number, y: number, w: number, h: number, rr = 3): BodyShape => ({ m, t: "r", x, y, w, h, r: rr });

const head = [e(null, 50, 14, 8.5, 10.5), r(null, 45.5, 23, 9, 8, 2)];
const limbsShared = [
  ...pair(e("forearms", 22, 83, 4.5, 11)),
  ...pair(e(null, 20, 99, 3.6, 4.6)), // hands
  ...pair(e(null, 40, 190, 5.5, 3)), // feet
];

export const FRONT: BodyShape[] = [
  ...head,
  ...pair(e("shoulders", 31, 41, 8, 7)),
  ...pair(e("chest", 41, 48, 9.5, 7.5)),
  ...pair(e("biceps", 26, 61, 5, 10)),
  ...[57, 67, 77].flatMap((y) => pair(r("abs", 43.5, y, 6, 8.5, 2.5))),
  ...pair(e("obliques", 36.5, 72, 4, 11)),
  ...pair(e("abductors", 32.5, 97, 3.5, 7)),
  ...pair(e("adductors", 46, 108, 3.5, 11)),
  ...pair(e("quads", 39, 122, 7.5, 19)),
  ...pair(e(null, 40, 145.5, 4, 3.5)), // knees
  ...pair(e("calves", 40, 166, 5, 15)),
  ...limbsShared,
];

export const BACK: BodyShape[] = [
  ...head,
  { m: "traps", t: "p", d: "M50 25 L62 37 L50 46 L38 37 Z" },
  ...pair(e("rear delts", 31, 41, 7.5, 6.5)),
  ...pair(e("upper back", 43, 52, 6, 6)),
  ...pair(e("lats", 37, 65, 6.5, 12)),
  r("lower back", 44, 66, 12, 20, 4),
  ...pair(e("triceps", 26, 61, 5, 10)),
  ...pair(e("glutes", 42, 98, 8.5, 9)),
  ...pair(e("hamstrings", 40, 126, 7, 17)),
  ...pair(e("calves", 40, 163, 6, 13)),
  ...limbsShared,
];

/** One shape as an SVG element string, for the share image. */
export function shapeToSvg(s: BodyShape, dx: number, attrs: string): string {
  if (s.t === "e") return `<ellipse cx="${s.cx + dx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs}/>`;
  if (s.t === "r") return `<rect x="${s.x + dx}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ${attrs}/>`;
  return `<path d="${s.d}" transform="translate(${dx} 0)" ${attrs}/>`;
}
