import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3efe4",
        cream: "#fffdf8",
        ink: "#1a1814",
        muted: "#6b6458",
        line: "#e4ddd0",
        pine: "#1b4d3e",
        "pine-hover": "#163f33",
        danger: "#9b2c2c",
        bronze: "#a47148",
        silver: "#7c8188",
        gold: "#b8860b",
        platinum: "#4a5560",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(26,24,20,0.04), 0 12px 32px -16px rgba(26,24,20,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
