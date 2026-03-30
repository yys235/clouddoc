import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        mist: "#eef3f7",
        accent: "#246bce",
        sand: "#f8f5ef",
      },
      fontFamily: {
        sans: ["'Noto Sans SC'", "'Helvetica Neue'", "Arial", "sans-serif"],
      },
      boxShadow: {
        panel: "0 18px 40px rgba(24, 33, 47, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

