import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FAF8F3",
        beige: "#E8DDD0",
        stone: "#C4B5A5",
        charcoal: "#2A2A2A",
        ink: "#1A1A1A",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(26,26,26,0.06), 0 1px 2px -1px rgba(26,26,26,0.04)",
        "card-md": "0 4px 12px -2px rgba(26,26,26,0.08), 0 2px 4px -2px rgba(26,26,26,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
