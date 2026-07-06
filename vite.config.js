import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("jspdf")) return "pdf";
          if (id.includes("@supabase")) return "supabase";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
