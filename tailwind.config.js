/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        body: ["Plus Jakarta Sans", "sans-serif"],
      },
      colors: {
        canvas: "#f2f4f7",
        ink: "#0b3558",
        brand: {
          50: "#eef4f7",
          100: "#d6e4ee",
          200: "#b8ccdb",
          300: "#88a8c0",
          400: "#4d7a9c",
          500: "#0b3558",
          600: "#082947",
          700: "#061f37",
          800: "#041728",
        },
        accent: {
          50: "#ecfcf3",
          100: "#d0f8e1",
          200: "#a4efc3",
          300: "#6be09a",
          400: "#38d578",
          500: "#1ecf6b",
          600: "#18b25b",
          700: "#128d48",
        },
        gold: {
          50: "#fffbea",
          100: "#fff2c1",
          200: "#fbe37c",
          300: "#f5d247",
          400: "#ddb930",
        },
        surface: {
          50: "#fafbfc",
          100: "#f4f6f8",
          200: "#e8edf2",
          300: "#d8e0e8",
        },
      },
      boxShadow: {
        soft: "0 24px 60px rgba(7, 30, 52, 0.09)",
        glass: "0 12px 36px rgba(7, 30, 52, 0.08)",
        floating: "0 28px 70px rgba(7, 30, 52, 0.14)",
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at 0% 0%, rgba(11,53,88,0.14), transparent 24%), radial-gradient(circle at 85% 10%, rgba(30,207,107,0.12), transparent 20%), radial-gradient(circle at 70% 80%, rgba(245,210,71,0.14), transparent 18%)",
        "brand-grid":
          "linear-gradient(rgba(11,53,88,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,53,88,0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
