import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { request, setConnection } from "./client";
import { ApiError } from "./errors";

let server: Server | null = null;

afterEach(async () => {
  setConnection(null);
  const instance = server;
  server = null;
  if (instance === null) return;
  await new Promise<void>((resolve) => {
    instance.close(() => resolve());
    instance.closeAllConnections();
  });
});

describe("request", () => {
  it("rejects a 404 JSON envelope with its own message, not as an unanswered request", async () => {
    const instance = createServer((_req, res) => {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: { code: "gateway.routing.not_found", message: "Route not found." },
        }),
      );
    });
    server = instance;
    await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
    setConnection({
      baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
      token: "jwt-1",
    });

    const failure = await request("/api/agent?limit=1000").catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      code: "not_found",
      status: 404,
      message: "Route not found.",
      detail: "gateway.routing.not_found",
    });
  });
});
