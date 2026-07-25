const DASHBOARD_USERNAME = "monitor";

export async function isDashboardAuthorized(
  request: Request,
  expectedPassword: string,
): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  let credentials: string;
  try {
    credentials = atob(authorization.slice("Basic ".length));
  } catch {
    return false;
  }

  const separator = credentials.indexOf(":");
  if (separator === -1) {
    return false;
  }

  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  if (username !== DASHBOARD_USERNAME) {
    return false;
  }

  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(password)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedPassword)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

export function unauthorizedResponse(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="CF Usage Monitor", charset="UTF-8"',
    },
  });
}

