import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: ".",
  envDir: ".",
  plugins: [react()],
  server: {
    host: process.env.VITE_DAL_DEV_HOST || "0.0.0.0",
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.VITE_DAL_DEV_API_PROXY || "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: process.env.VITE_DAL_PREVIEW_HOST || "0.0.0.0",
    port: 4174,
  },
  build: {
    outDir: "dist-dal",
    emptyOutDir: true,
  },
});
