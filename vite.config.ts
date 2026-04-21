import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          // Keep React + everything that depends on React's context (Radix, Router,
          // Query, Tooltip primitives, etc.) in ONE chunk so React is defined
          // before any consumer module evaluates. Splitting them caused
          // "Cannot read properties of undefined (reading 'createContext')".
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler") ||
            id.includes("react-router") ||
            id.includes("@radix-ui") ||
            id.includes("@tanstack") ||
            id.includes("react-hook-form") ||
            id.includes("react-day-picker") ||
            id.includes("lucide-react") ||
            id.includes("sonner") ||
            id.includes("cmdk") ||
            id.includes("vaul")
          ) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("date-fns")) return "vendor-date";
          return "vendor";
        },
      },
    },
  },
}));
