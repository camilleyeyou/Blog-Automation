import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Dark UI ───────────────────────────────────
        bg:      "#1b1d26",
        surface: "#21242e",
        raised:  "#282c38",
        edge:    "#2e3348",
        muted:   "#8891a8",
        // ── Accent ────────────────────────────────────
        amber: {
          DEFAULT: "#f5a623",
          dim:     "rgba(245,166,35,0.10)",
        },
        // ── Legacy (post preview prose only) ──────────
        cream:    "#FAF8F3",
        beige:    "#E8DDD0",
        stone:    "#C4B5A5",
        charcoal: "#2A2A2A",
        ink:      "#1A1A1A",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card:     "0 1px 4px rgba(0,0,0,0.35)",
        "card-md":"0 4px 20px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
