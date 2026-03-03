import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
	],
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
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
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
				violet: {
					50: "#F5F3FF",
					100: "#EDE9FE",
					200: "#DDD6FE",
					300: "#C4B5FD",
					400: "#A78BFA",
					500: "#8B5CF6",
					600: "#7C3AED",
					700: "#6D28D9",
					800: "#5B21B6",
					900: "#4C1D95",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
				"2xl": "1.5rem",
				"3xl": "2rem",
				"4xl": "2.5rem",
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
			},
			backgroundImage: {
				"gradient-primary": "linear-gradient(135deg, #6C63FF 0%, #8E7CFF 50%, #C084FC 100%)",
				"gradient-income": "linear-gradient(135deg, #10B981, #34D399)",
				"gradient-expense": "linear-gradient(135deg, #EF4444, #F87171)",
				"gradient-dark": "linear-gradient(135deg, #1E1B4B, #312E81)",
				"gradient-card": "linear-gradient(135deg, #6C63FF, #C084FC)",
				"gradient-blue": "linear-gradient(135deg, #3B82F6, #60A5FA)",
				"gradient-gold": "linear-gradient(135deg, #F59E0B, #FBBF24)",
			},
			boxShadow: {
				"glow": "0 0 30px rgba(108, 99, 255, 0.3)",
				"glow-sm": "0 0 15px rgba(108, 99, 255, 0.2)",
				"card": "0 4px 24px rgba(108, 99, 255, 0.08)",
				"card-hover": "0 8px 40px rgba(108, 99, 255, 0.15)",
				"bottom-nav": "0 -4px 24px rgba(0,0,0,0.08)",
			},
			animation: {
				"float": "float 3s ease-in-out infinite",
				"glow-pulse": "glowPulse 2s ease-in-out infinite",
				"slide-up": "slideUp 0.3s ease-out",
				"fade-in": "fadeIn 0.2s ease-out",
			},
			keyframes: {
				float: {
					"0%, 100%": { transform: "translateY(0px)" },
					"50%": { transform: "translateY(-6px)" },
				},
				glowPulse: {
					"0%, 100%": { boxShadow: "0 0 15px rgba(108, 99, 255, 0.2)" },
					"50%": { boxShadow: "0 0 40px rgba(108, 99, 255, 0.5)" },
				},
				slideUp: {
					from: { transform: "translateY(16px)", opacity: "0" },
					to: { transform: "translateY(0)", opacity: "1" },
				},
				fadeIn: {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};

export default config;
