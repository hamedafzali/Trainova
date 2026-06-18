import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        surface: "#141a22",
        surface2: "#1c2530",
        border: "#27313d",
        accent: "#22d3a6",
        accentDim: "#0f5f4d",
        danger: "#f4506b",
        muted: "#8a97a6",
      },
    },
  },
  plugins: [],
};

export default config;
