import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { request, requestBlob, requestText, setConnection } from "./client";
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

describe("requestText", () => {
  async function serveText(status: number, text: string): Promise<string[]> {
    const authorizations: string[] = [];
    const instance = createServer((req, res) => {
      authorizations.push(req.headers.authorization ?? "");
      res.writeHead(status, { "content-type": "application/yaml" });
      res.end(text);
    });
    server = instance;
    await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
    setConnection({
      baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
      token: "jwt-1",
    });
    return authorizations;
  }

  it("answers the body text and sends the bearer token", async () => {
    const authorizations = await serveText(200, "openapi: 3.1.0\n");
    expect(await requestText("/api/openapi.yaml")).toBe("openapi: 3.1.0\n");
    expect(authorizations).toEqual(["Bearer jwt-1"]);
  });

  it("rejects a failed status as an ApiError", async () => {
    await serveText(503, "down");
    await expect(requestText("/api/openapi.yaml")).rejects.toMatchObject({
      status: 503,
      message: "The daemon refused the request.",
    });
  });

  it("rejects without a connection", async () => {
    await expect(requestText("/api/openapi.yaml")).rejects.toMatchObject({
      code: "unreachable",
      message: "No server is connected.",
    });
  });
});

describe("requestBlob", () => {
  async function serveBlob(
    status: number,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ authorizations: string[]; port: number }> {
    const authorizations: string[] = [];
    const instance = createServer((req, res) => {
      authorizations.push(req.headers.authorization ?? "");
      res.writeHead(status, headers);
      res.end(body);
    });
    server = instance;
    await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
    const port = (instance.address() as AddressInfo).port;
    setConnection({ baseUrl: `http://127.0.0.1:${port}`, token: "jwt-1" });
    return { authorizations, port };
  }

  it("sends the bearer token and answers the blob", async () => {
    const { authorizations } = await serveBlob(
      200,
      { "content-type": "application/octet-stream" },
      "bytes",
    );
    const answer = await requestBlob("/api/mission/evidence/asset/a/content/download");
    expect(await answer.blob.text()).toBe("bytes");
    expect(authorizations).toEqual(["Bearer jwt-1"]);
  });

  it("reads the file name of a cross-origin answer through the exposed header", async () => {
    await serveBlob(
      200,
      {
        "content-type": "application/octet-stream",
        "content-disposition": 'attachment; filename="asset_1.txt"',
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "Content-Disposition",
      },
      "bytes",
    );
    const answer = await requestBlob("/api/mission/evidence/asset/asset_1/content/download");
    expect(answer.headers.get("content-disposition")).toBe('attachment; filename="asset_1.txt"');
  });

  it("throws the envelope of a 502 as an ApiError", async () => {
    await serveBlob(
      502,
      { "content-type": "application/json" },
      JSON.stringify({
        error: {
          code: "mission.evidence.content_unavailable",
          message: "The storage read failed.",
        },
      }),
    );
    const failure = await requestBlob("/x").catch((cause: unknown) => cause);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      code: "malformed",
      status: 502,
      message: "The storage read failed.",
      detail: "mission.evidence.content_unavailable",
    });
  });

  it("throws a failed answer without JSON as an ApiError", async () => {
    await serveBlob(502, { "content-type": "text/plain" }, "bad gateway");
    await expect(requestBlob("/x")).rejects.toMatchObject({ status: 502 });
  });

  it("rejects without a connection", async () => {
    await expect(requestBlob("/x")).rejects.toMatchObject({
      code: "unreachable",
      message: "No server is connected.",
    });
  });
});
