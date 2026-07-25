import app from "../src/server/app";
import { runMonitor } from "../src/server/monitor";

export default {
  fetch: app.fetch,
  async scheduled(controller, env): Promise<void> {
    await runMonitor(controller.scheduledTime, env);
  },
} satisfies ExportedHandler<Env>;
