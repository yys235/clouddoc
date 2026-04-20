import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#eef2f6",
        accent: "#1d4f91",
        sand: "#f4f6f8",
      },
      fontFamily: {
        sans: ["'Noto Sans SC'", "'Helvetica Neue'", "Arial", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(17, 24, 39, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
