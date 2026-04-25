/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#e8a5b5",
          dark: "#d48fa0",
          light: "#f5d6dd",
        },
        secondary: "#fcfaf9",
      },

      // ── Custom shadows ────────────────────────────────────────────
      boxShadow: {
        'card':         '0 2px 16px 0 rgba(0,0,0,0.06)',
        'card-hover':   '0 8px 32px 0 rgba(0,0,0,0.12)',
        'glow-pink':    '0 0 24px 0 rgba(232,165,181,0.45)',
        'glow-purple':  '0 0 24px 0 rgba(139,92,246,0.35)',
        'glow-blue':    '0 0 24px 0 rgba(59,130,246,0.35)',
        'inner-soft':   'inset 0 1px 4px 0 rgba(0,0,0,0.06)',
        // ── Dark / neon shadows ──────────────────────────────────
        'neon-violet':  '0 0 20px rgba(139,92,246,0.55), 0 0 60px rgba(139,92,246,0.20)',
        'neon-cyan':    '0 0 20px rgba(6,182,212,0.55),  0 0 60px rgba(6,182,212,0.20)',
        'neon-pink':    '0 0 20px rgba(236,72,153,0.55), 0 0 60px rgba(236,72,153,0.20)',
        'neon-green':   '0 0 20px rgba(16,185,129,0.55), 0 0 60px rgba(16,185,129,0.20)',
        'dark-card':    '0 4px 24px rgba(0,0,0,0.4)',
        'dark-card-hover':'0 8px 40px rgba(0,0,0,0.6)',
      },

      // ── Gradient color stops ──────────────────────────────────────
      backgroundImage: {
        'gradient-meday':   'linear-gradient(135deg, #e8a5b5 0%, #c084fc 100%)',
        'gradient-purple':  'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
        'gradient-blue':    'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
        'gradient-green':   'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)',
        'gradient-amber':   'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
        'mesh-light':       'radial-gradient(at 20% 20%, #fde8d0 0px, transparent 50%), radial-gradient(at 80% 80%, #fef3e2 0px, transparent 50%)',
        // ── Dark theme gradients ─────────────────────────────────
        'dark-page':        'radial-gradient(ellipse at 20% 0%, rgba(139,92,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.10) 0%, transparent 50%)',
        'neon-violet-grad': 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        'neon-cyan-grad':   'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
        'neon-pink-grad':   'linear-gradient(135deg, #db2777 0%, #ec4899 100%)',
        'neon-green-grad':  'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        'glass-card':       'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      },

      // ── Border radius ─────────────────────────────────────────────
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      // ── Backdrop blur ─────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },

      // ── Animations ────────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.5s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'shimmer':    'shimmer 1.6s infinite linear',
        'float':      'float 3s ease-in-out infinite',
        'bar-grow':   'barGrow 0.6s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition:  '400px 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        barGrow: {
          '0%':   { transform: 'scaleX(0)', transformOrigin: 'right' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'right' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}