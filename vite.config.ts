import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 4310,
    host: true,
  },
  preview: {
    port: 4310,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
