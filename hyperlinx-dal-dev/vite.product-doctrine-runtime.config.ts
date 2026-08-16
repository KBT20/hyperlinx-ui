import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    outDir: "server/generated",
    emptyOutDir: true,
    lib: {
      entry: "src/server/ProductDoctrineRuntime.ts",
      formats: ["es"],
      fileName: () => "product-doctrine-runtime.js",
    },
    rollupOptions: {
      external: [/^node:/],
    },
  },
});
