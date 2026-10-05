import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { readLiveness, verifyHumanToken } from "./gateway";

let server: Server | null = null;
let seen: IncomingMessage | null = null;

async function serve(status: number, body: unknown): Promise<string> {
  const instance = createServer((req, res) => {
    seen = req;
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
}

async function closedBaseUrl(): Promise<string> {
  const base = await serve(200, {});
  await closeServer();
  return base;
}

async function closeServer(): Promise<void> {
  const instance = server;
  server = null;
  if (instance === null) return;
  await new Promise<void>((resolve) => {
    instance.close(() => resolve());
    instance.closeAllConnections();
  });
}

afterEach(async () => {
  seen = null;
  setConnection(null);
  await closeServer();
});

describe("readLiveness", () => {
  it("reports a healthy instance on 200 and sends no token", async () => {
    const base = await serve(200, { status: "ok", services: { server: { store: 200 } } });
    expect(await readLiveness(`${base}/`)).toEqual({
      healthy: true,
      services: { server: { store: 200 } },
    });
    expect(seen?.url).toBe("/api/liveness");
    expect(seen?.headers.authorization).toBeUndefined();
  });

  it("reports an unhealthy instance on 503 as an answer", async () => {
    const services = { server: { store: 503 } };
    const base = await serve(503, {
      error: { code: "gateway.liveness.unhealthy", message: "Down.", details: services },
      requestId: "r1",
    });
    expect(await readLiveness(base)).toEqual({ healthy: false, services });
  });

  it("rejects with unavailable on another 503", async () => {
    const base = await serve(503, {
      error: { code: "NOT_READY", message: "Not ready." },
      requestId: "r1",
    });
    await expect(readLiveness(base)).rejects.toMatchObject({ code: "unavailable", status: 503 });
  });

  it("rejects with unreachable on a closed port", async () => {
    await expect(readLiveness(await closedBaseUrl())).rejects.toMatchObject({
      code: "unreachable",
    });
  });
});

describe("verifyHumanToken", () => {
  it("resolves the identity and sends the bearer token", async () => {
    const identity = { kind: "human", sub: "kanthorlabs", name: "Kanthor Labs" };
    const base = await serve(200, identity);
    expect(await verifyHumanToken(base, "abc")).toEqual(identity);
    expect(seen?.url).toBe("/api/auth/verify");
    expect(seen?.headers.authorization).toBe("Bearer abc");
  });

  it("rejects with unauthorized on 401", async () => {
    const base = await serve(401, {
      error: { code: "UNAUTHORIZED", message: "No." },
      requestId: "r1",
    });
    await expect(verifyHumanToken(base, "bad")).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("rejects with unauthorized when the kind is not human", async () => {
    const base = await serve(200, { kind: "client", sub: "client_identity_1", name: "x" });
    await expect(verifyHumanToken(base, "machine")).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("rejects with unreachable on a closed port", async () => {
    await expect(verifyHumanToken(await closedBaseUrl(), "abc")).rejects.toMatchObject({
      code: "unreachable",
    });
  });
});
