/**
 * A development stand-in for the kanthord daemon.
 *
 * It serves the contract that src/api derives from the design set, so the
 * dashboard runs before the daemon exists. It is not part of the application
 * and no module under src/ reaches it.
 */
import { createServer } from "node:http";

import {
  DEV_TOKEN,
  GUEST_PATH,
  json,
  ORIGIN,
  PORT,
  projectEnvelope,
  PUBLIC,
  routes,
  USERNAME,
} from "./routes.mjs";

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

createServer((req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, null);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw.length === 0 ? null : JSON.parse(raw);
    const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
    if (!route) return projectEnvelope(res, 404, "gateway.routing.not_found", "Route not found.");

    const open =
      GUEST_PATH.test(url.pathname) ||
      PUBLIC.some((p) => p.method === req.method && p.path === url.pathname);
    if (!open && token !== DEV_TOKEN) {
      return projectEnvelope(
        res,
        401,
        "gateway.authentication.unauthorized",
        "The request carries no valid human token.",
      );
    }
    const idempotencyKey = req.headers["idempotency-key"];
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return projectEnvelope(
        res,
        400,
        "gateway.idempotency.invalid_key",
        "Idempotency-Key must be idempotency_key_ followed by a canonical ULID.",
      );
    }
    try {
      route.handler(route.pattern.exec(url.pathname), body, res, token, url);
    } catch {
      projectEnvelope(res, 500, "gateway.http.failed", "HTTP request failed.");
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  process.stdout.write(
    `mock daemon on http://localhost:${PORT} (origin ${ORIGIN}, account ${USERNAME})\ndev token: ${DEV_TOKEN}\n`,
  );
});
