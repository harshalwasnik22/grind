import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The scoring engine and helpers are pure — a node environment is enough.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
