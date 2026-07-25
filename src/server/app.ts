import { Hono } from "hono";
import { isDashboardAuthorized, unauthorizedResponse } from "../auth";
import { api } from "./api";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (context, next) => {
  if (context.req.path === "/health") {
    await next();
    return;
  }
  const authorized = await isDashboardAuthorized(
    context.req.raw,
    context.env.DASHBOARD_PASSWORD,
  );
  if (!authorized) {
    return unauthorizedResponse();
  }
  await next();
});

app.get("/health", (context) =>
  context.json({ ok: true, service: "cf-usage-monitor" }),
);

app.route("/api", api);

app.all("*", async (context) => {
  const response = await context.env.ASSETS.fetch(context.req.raw);
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  const hostname = new URL(context.req.url).hostname;
  const isLocalDevelopment = hostname === "localhost" || hostname === "127.0.0.1";
  if (
    headers.get("Content-Type")?.startsWith("text/html") &&
    !isLocalDevelopment
  ) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; " +
        "connect-src 'self'; img-src 'self' data:; object-src 'none'; " +
        "base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
});

app.onError((error, context) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_failed",
      method: context.req.method,
      path: context.req.path,
      message: error.message,
    }),
  );
  if (context.req.path.startsWith("/api/")) {
    return context.json({ error: "Internal server error" }, 500);
  }
  return context.text("Internal server error", 500);
});

export default app;
