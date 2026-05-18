import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    fileParallelism: false,
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: [
        "repositories/deviceRepository.js",
        "services/authService.js",
        "services/deviceService.js",
        "utils/index.js",
      ],
      exclude: [
        "app.js",
        "server.js",
        "tests/**",
        "scripts/**",
        "drizzle/**",
        "data/**",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
