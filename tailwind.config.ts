import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Dark glassmorphism theme — matches globals.css / .card / .btn-primary.
        // Names kept stable (still referenced by session/profile/admin/etc.); roles added.
        bg: "#0a0a0f", // canvas
        surface: "rgba(255,255,255,0.05)", // card
        surface2: "rgba(255,255,255,0.08)", // wells / inputs / steppers
        border: "rgba(255,255,255,0.1)",
        accent: "#3b82f6", // blue-500 — primary / active
        accentDim: "#3a4a63", // muted slate-blue — rest / secondary
        danger: "#f87171", // red-400 — fail / skip
        muted: "#94a3b8", // slate-400
        ink: "#f5f5f7", // primary text
        inkSoft: "#b8bcc8", // secondary text
        green: "#4ade80", // success / completed
        gold: "#fbbf24", // PR / highlight
        amber: "#fb923c", // fatigue (RPE ≥ 9)
        onAccent: "#ffffff", // text on accent fills
        clayDeep: "#1d4ed8", // blue-700 — pressed accent
      },
      keyframes: {
        completeWipe: {
          "0%": { backgroundColor: "transparent" },
          "40%": { backgroundColor: "rgba(110,158,107,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        popIn: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.12)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        prRing: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.07)" },
        },
        breathe: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        completeWipe: "completeWipe 600ms ease-out",
        popIn: "popIn 180ms ease-out",
        prRing: "prRing 700ms ease-in-out 2",
        breathe: "breathe 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
