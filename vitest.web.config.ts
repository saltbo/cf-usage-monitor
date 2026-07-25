import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/client/**/*.test.ts", "src/client/**/*.test.tsx"],
    setupFiles: ["./src/client/test/setup.ts"],
  },
});
