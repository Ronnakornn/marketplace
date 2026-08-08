import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Large jsdom suites contend heavily when Vitest uses every logical CPU.
    // Four workers kept isolated timings representative while avoiding timeout cascades.
    maxWorkers: 4,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./app", import.meta.url)),
      "#": fileURLToPath(new URL("./app", import.meta.url)),
      "#server": fileURLToPath(new URL("./server", import.meta.url)),
      "#generated": fileURLToPath(new URL("./generated", import.meta.url)),
    },
  },
});
