/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        cream: "#fff7e8",
        punch: {
          yellow: "#ffe566",
          pink: "#ff7db8",
          cyan: "#77e5ff",
          orange: "#ff9b54",
          mint: "#9cffb0",
        },
      },
      fontFamily: {
        display: ["'Bungee'", "cursive"],
        body: ["'Space Grotesk'", "sans-serif"],
      },
      boxShadow: {
        brutal: "6px 6px 0 0 #111111",
        "brutal-lg": "10px 10px 0 0 #111111",
        "brutal-sm": "4px 4px 0 0 #111111",
      },
      borderRadius: {
        brutal: "1.5rem",
      },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        blink: {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "94%": { transform: "scaleY(0.1)" },
          "96%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        bob: "bob 3s ease-in-out infinite",
        blink: "blink 5s infinite",
      },
    },
  },
  plugins: [],
};
