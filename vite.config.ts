import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // 빌드 시점 날짜를 주입한다. 기존 사이드바 푸터는 "build 2026.05.14" 가
  // 하드코딩돼 빌드와 무관하게 영원히 stale 했다. 이제 실제 빌드(또는 dev 서버
  // 기동) 날짜를 반영한다.
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
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
