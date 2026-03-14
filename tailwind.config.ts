import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0B0E14",
        "bg-elevated": "#12161F",
        "bg-surface": "#181D28",
        "bg-surface-hover": "#1E2433",
        "text-primary": "#E8ECF4",
        "text-secondary": "#6B7A90",
        "text-tertiary": "#3D4B5F",
        "accent-blue": "#3B82F6",
        "accent-red": "#EF4444",
        "accent-amber": "#F59E0B",
        "accent-green": "#10B981",
        border: "rgba(255,255,255,0.06)",
        "border-active": "rgba(255,255,255,0.12)",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
