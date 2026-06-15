import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run source tests; never the compiled copies emitted into dist/.
    include: ["src/**/*.test.ts"],
  },
});
