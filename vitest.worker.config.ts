import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        compatibilityDate: "2026-07-21",
        bindings: {
          ALERT_EMAIL_FROM: "alerts@example.com",
          ALERT_EMAIL_TO: "owner@example.com",
          ALERT_WEBHOOK_URL: "https://example.com/webhook",
          CF_API_TOKEN: "test-token",
          DASHBOARD_PASSWORD: "test-password",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
