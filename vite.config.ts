import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "src", "shared"),
    },
  },
  server: {
    port: 5173,
    // Proxy /api to the Express backend during local development. In production
    // Vercel's rewrite rule (vercel.json) does the equivalent for the deployed
    // bundle.
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
