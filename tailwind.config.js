/** @type {import('tailwindcss').Config} */
export default {
  // הגדרת הנתיבים שבהם Tailwind יחפש שמות של מחלקות (Classes)
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // הגדרת הצבעים המזוהים עם MeDay - ירוק וביז
        primary: {
          DEFAULT: "#5f8f6f", // ירוק סג
          dark: "#3d6e4f",
          light: "#a8d5a8",
        },
        secondary: "#f3ede3", // צבע רקע בז וחם
        accent: {
          DEFAULT: "#4a7c59",
          light: "#dceed6",
        },
      },
      // הגדרת אנימציות (בשביל הצ'אט ודף הבית)
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}