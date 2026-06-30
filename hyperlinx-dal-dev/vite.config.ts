import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devApiProxy = process.env.VITE_DAL_DEV_API_PROXY?.trim();
const devPort = process.env.VITE_DAL_DEV_PORT ? Number(process.env.VITE_DAL_DEV_PORT) : undefined;
const previewPort = process.env.VITE_DAL_PREVIEW_PORT ? Number(process.env.VITE_DAL_PREVIEW_PORT) : undefined;

export default defineConfig({
  root: ".",
  envDir: ".",
  plugins: [react()],
  server: {
    host: process.env.VITE_DAL_DEV_HOST || "0.0.0.0",
    port: devPort,
    proxy: devApiProxy ? {
      "/api": {
        target: devApiProxy,
        changeOrigin: true,
      },
    } : undefined,
  },
  preview: {
    host: process.env.VITE_DAL_PREVIEW_HOST || "0.0.0.0",
    port: previewPort,
  },
  build: {
    outDir: "dist-dal",
    emptyOutDir: true,
  },
});
