import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm nude theme (see UX_REDESIGN.md §4). Names kept stable; roles added.
        bg: "#F4ECE1", // canvas
        surface: "#ECE0D1", // card
        surface2: "#E3D4C1", // wells / inputs / steppers
        border: "#D6C4AE",
        accent: "#BC6B47", // terracotta — primary / active
        accentDim: "#7C8254", // olive — rest / secondary
        danger: "#C07A6E", // muted red — fail / skip
        muted: "#9A8B79",
        ink: "#38302A", // primary text
        inkSoft: "#6B5E50", // secondary text
        green: "#6E9E6B", // success / completed
        gold: "#C7A24B", // PR / highlight
        amber: "#C98A5E", // fatigue (RPE ≥ 9)
        onAccent: "#FBF4EC", // text on accent fills
        clayDeep: "#9E5B3B", // pressed terracotta
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
