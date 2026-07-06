/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Manrope", "sans-serif"],
      },
      colors: {
        canvas: "#f8fbff",
        ink: "#1f3b5b",
        accent: {
          50: "#f0f8ff",
          100: "#dceefe",
          200: "#c5e4fd",
          500: "#4a90d9",
          600: "#387fc9",
          700: "#2d6fb4",
        },
        gold: "#d9ecff",
        coral: "#7cb4e8",
      },
      boxShadow: {
        soft: "0 22px 50px rgba(93, 142, 194, 0.12)",
        glass: "0 10px 30px rgba(94, 145, 196, 0.1)",
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at 20% 20%, rgba(74,144,217,0.10), transparent 25%), radial-gradient(circle at 80% 0%, rgba(220,238,254,0.8), transparent 24%), radial-gradient(circle at 80% 80%, rgba(124,180,232,0.10), transparent 18%)",
      },
    },
  },
  plugins: [],
};
