// Shareable workout recap: a 1080 × 1350 (4:5, feed-friendly) image built as
// an SVG string, rasterised to PNG on a canvas, then handed to the native share
// sheet. Its palette is fixed, not themed: the image looks the same wherever it
// is posted, whatever mode the app was in.

import { BACK, BACK_OFFSET, FRONT, shapeToSvg } from "@/lib/bodyShapes";
import { label, type Muscle } from "@/domain/taxonomy";

export interface RecapData {
  title: string;
  dateLabel: string;
  duration: string;
  volume: string;
  sets: number;
  prNames: string[];
  /** Working sets per muscle (primary 1, secondary 0.5). */
  muscles: Map<Muscle, number>;
  topSets: { name: string; detail: string }[];
}

export const RECAP_W = 1080;
export const RECAP_H = 1350;

const C = {
  bg: "#0B0F1A",
  glow: "#4F7FFF",
  ink: "#FFFFFF",
  soft: "#C9D1E0",
  muted: "#8E98AC",
  accent: "#7FA2FF",
  gold: "#F5C25B",
  tile: "#2F5FE0",
};
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function text(x: number, y: number, size: number, fill: string, body: string, extra = "") {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escapeXml(body)}</text>`;
}

function muscleOpacity(sets: number) {
  return sets >= 4 ? 1 : sets >= 2 ? 0.72 : sets > 0 ? 0.42 : 0;
}

export function recapSvg(d: RecapData): string {
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${RECAP_W}" height="${RECAP_H}" viewBox="0 0 ${RECAP_W} ${RECAP_H}" font-family="${FONT}">`,
    `<defs><radialGradient id="g" cx="0.85" cy="0.05" r="0.9"><stop offset="0" stop-color="${C.glow}" stop-opacity="0.45"/><stop offset="0.6" stop-color="${C.glow}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect width="${RECAP_W}" height="${RECAP_H}" fill="${C.bg}"/><rect width="${RECAP_W}" height="${RECAP_H}" fill="url(#g)"/>`,
  );

  // Brand row
  out.push(
    `<g transform="translate(72 72) scale(0.125)"><rect width="512" height="512" rx="112" fill="${C.tile}"/><g fill="#fff" transform="translate(20.5 20.5) scale(0.92)"><rect x="78" y="112" width="44" height="124" rx="14"/><rect x="130" y="134" width="30" height="80" rx="10"/><rect x="352" y="134" width="30" height="80" rx="10"/><rect x="390" y="112" width="44" height="124" rx="14"/><rect x="150" y="154" width="212" height="40" rx="10"/><rect x="224" y="174" width="64" height="230" rx="32"/></g></g>`,
    text(152, 117, 34, C.ink, "Trainova", `font-weight="700"`),
    text(1008, 117, 28, C.muted, d.dateLabel, `text-anchor="end"`),
  );

  // Title
  const title = clip(d.title, 26);
  out.push(
    text(72, 214, 26, C.accent, "WORKOUT COMPLETE", `font-weight="700" letter-spacing="4"`),
    text(72, 292, title.length > 18 ? 62 : 76, C.ink, title, `font-weight="800" letter-spacing="-1.5"`),
  );

  // Stats
  const stats = [
    { v: d.duration, l: "Time" },
    { v: d.volume, l: "Volume" },
    { v: String(d.sets), l: "Sets" },
    { v: String(d.prNames.length), l: "PRs" },
  ];
  stats.forEach((s, i) => {
    const x = 72 + i * 240;
    out.push(
      `<rect x="${x}" y="340" width="216" height="150" rx="28" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.1"/>`,
      text(x + 108, 420, clip(s.v, 8).length > 6 ? 40 : 52, s.l === "PRs" && d.prNames.length ? C.gold : C.ink, clip(s.v, 8), `font-weight="800" text-anchor="middle"`),
      text(x + 108, 460, 22, C.muted, s.l.toUpperCase(), `text-anchor="middle" letter-spacing="2"`),
    );
  });

  // Body map
  out.push(`<g transform="translate(60 540) scale(2.3)">`);
  const draw = (shapes: typeof FRONT, dx: number) => {
    for (const s of shapes) {
      const o = s.m ? muscleOpacity(d.muscles.get(s.m) ?? 0) : 0;
      const attrs = o > 0 ? `fill="${C.glow}" fill-opacity="${o}"` : `fill="#FFFFFF" fill-opacity="${s.m ? 0.09 : 0.06}"`;
      out.push(shapeToSvg(s, dx, attrs));
    }
  };
  draw(FRONT, 0);
  draw(BACK, BACK_OFFSET);
  out.push(`</g>`);

  // Top sets
  out.push(text(620, 556, 22, C.muted, "TOP SETS", `font-weight="700" letter-spacing="3"`));
  d.topSets.slice(0, 4).forEach((t, i) => {
    const y = 610 + i * 104;
    out.push(
      text(620, y, 30, C.ink, clip(t.name, 22), `font-weight="700"`),
      text(620, y + 42, 28, C.accent, clip(t.detail, 26), `font-weight="600"`),
    );
  });

  // Muscles hit
  const hit = [...d.muscles].filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).map(([m]) => label(m));
  if (hit.length) out.push(text(72, 1066, 26, C.soft, clip(`Trained: ${hit.slice(0, 5).join(" · ")}`, 64)));

  // PR banner
  if (d.prNames.length) {
    const body = `${d.prNames.length} new personal record${d.prNames.length > 1 ? "s" : ""} · ${d.prNames.join(", ")}`;
    out.push(
      `<rect x="72" y="1104" width="936" height="104" rx="28" fill="${C.gold}" fill-opacity="0.12" stroke="${C.gold}" stroke-opacity="0.55"/>`,
      `<g transform="translate(104 1130) scale(2.2)" fill="none" stroke="${C.gold}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></g>`,
      text(176, 1168, 30, C.gold, clip(body, 50), `font-weight="700"`),
    );
  } else {
    out.push(text(72, 1168, 30, C.muted, "Showing up is the hard part. Done."));
  }

  out.push(text(RECAP_W / 2, 1290, 24, C.muted, "Logged with Trainova", `text-anchor="middle" letter-spacing="1"`), `</svg>`);
  return out.join("");
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Rasterise the recap SVG to a PNG blob. */
export async function recapPng(svg: string): Promise<Blob> {
  const img = new Image();
  img.decoding = "async";
  img.src = svgDataUrl(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = RECAP_W;
  canvas.height = RECAP_H;
  canvas.getContext("2d")!.drawImage(img, 0, 0, RECAP_W, RECAP_H);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render image"))), "image/png"),
  );
}

/** Native share sheet with the image when supported, otherwise a download. Returns how it went. */
export async function shareRecap(svg: string, fileName: string): Promise<"shared" | "saved" | "cancelled"> {
  const blob = await recapPng(svg);
  const file = new File([blob], fileName, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My workout" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
}
