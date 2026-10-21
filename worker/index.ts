import app from "../src/server/app";
import { runScheduled } from "../src/server/schedule";

export default {
  fetch: app.fetch,
  async scheduled(controller, env): Promise<void> {
    await runScheduled(controller.scheduledTime, env);
  },
} satisfies ExportedHandler<Env>;
