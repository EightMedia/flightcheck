import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Source co-located tests + top-level tests/; never compiled copies in dist/.
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
