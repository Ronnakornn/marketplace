import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./app", import.meta.url)),
      "#": fileURLToPath(new URL("./app", import.meta.url)),
      "#server": fileURLToPath(new URL("./server", import.meta.url)),
      "#generated": fileURLToPath(new URL("./generated", import.meta.url)),
    },
  },
});
