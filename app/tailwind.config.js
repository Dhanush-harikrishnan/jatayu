/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // SecureGuard Pro mapped to Carbon Design System
        navy: {
          900: '#161616', // Core background
          800: '#262626', // Elevated background
          700: '#393939', // Layer
          600: '#525252',
        },
        cyan: {
          DEFAULT: '#f4f4f4', // Core text
          dark: '#c6c6c6',
          light: '#ffffff',
        },
        violation: {
          DEFAULT: '#da1e28', // Red 60
          dark: '#a2191f',
          light: '#ff8389',
        },
        success: {
          DEFAULT: '#f4f4f4', // Disable success colors, make them neutral
          dark: '#c6c6c6',
        },
        warning: {
          DEFAULT: '#f1c21b', // Yellow 30
        },
      },
      borderRadius: {
        xl: "0px",
        lg: "0px",
        md: "0px",
        sm: "0px",
        xs: "0px",
        '2xl': '0px',
        '3xl': '0px',
        full: "0px",
      },
      boxShadow: {
        xs: "none",
        'glow-cyan': 'none',
        'glow-cyan-strong': 'none',
        'glow-violation': 'none',
        'card': 'none',
        'glass': 'none',
      },
      fontFamily: {
        sora: ['IBM Plex Sans', 'sans-serif'],
        inter: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
      backgroundImage: {
        'gradient-radial': 'none',
        'gradient-conic': 'none',
        'glass': 'none',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
