import type { Config } from "tailwindcss";

// Every color comes from a CSS variable in src/styles/tokens.css, so light/dark themes switch
// by changing `data-theme` on <html> — components never hard-code theme colors.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: "var(--bg-page)",
        surface: "var(--bg-surface)",
        subtle: "var(--bg-subtle)",
        muted: "var(--bg-muted)",
        strong: "var(--bg-strong)",
        elevated: "var(--bg-elevated)",
        overlay: "var(--bg-overlay)",
        player: "var(--bg-player)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        title: "var(--text-title)",
        body: "var(--text-body)",
        secondary: "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        placeholder: "var(--text-placeholder)",
        "on-brand": "var(--text-on-brand)",
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          text: "var(--brand-text)",
          accent: "var(--brand-accent)",
          soft: "var(--brand-soft)",
          "soft-hover": "var(--brand-soft-hover)",
          "soft-border": "var(--brand-soft-border)",
        },
        timestamp: "var(--timestamp)",
        match: { bg: "var(--match-bg)", text: "var(--match-text)" },
        playing: { bg: "var(--playing-bg)", text: "var(--playing-text)" },
        success: { DEFAULT: "var(--success)", text: "var(--success-text)", bg: "var(--success-bg)" },
        danger: { DEFAULT: "var(--danger)", hover: "var(--danger-hover)", bg: "var(--danger-bg)" },
        warning: { DEFAULT: "var(--warning)", text: "var(--warning-text)", bg: "var(--warning-bg)" },
        upgrade: {
          bg: "var(--upgrade-bg)",
          text: "var(--upgrade-text)",
          border: "var(--upgrade-border)",
        },
        tint: {
          "rose-bg": "var(--tint-rose-bg)",
          "rose-border": "var(--tint-rose-border)",
          "green-bg": "var(--tint-green-bg)",
          "green-border": "var(--tint-green-border)",
          "indigo-bg": "var(--tint-indigo-bg)",
          "indigo-border": "var(--tint-indigo-border)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "14px" }],
        xs: ["12px", { lineHeight: "16px" }],
        "13": ["13px", { lineHeight: "18px" }],
        sm: ["14px", { lineHeight: "20px", letterSpacing: "-0.16px" }],
        "15": ["15px", { lineHeight: "24px", letterSpacing: "-0.16px" }],
        base: ["16px", { lineHeight: "24px", letterSpacing: "-0.18px" }],
        lg: ["18px", { lineHeight: "28px", letterSpacing: "-0.2px" }],
        xl: ["20px", { lineHeight: "28px", letterSpacing: "-0.2px" }],
        "2xl": ["24px", { lineHeight: "32px", letterSpacing: "-0.32px" }],
      },
      borderRadius: {
        DEFAULT: "4px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        focus: "var(--focus-ring)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        "slide-in-right": "slide-in-right 200ms ease-out",
        "slide-in-left": "slide-in-left 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
