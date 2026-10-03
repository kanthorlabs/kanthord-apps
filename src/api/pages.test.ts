import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "./client";
import { PAGE_BUDGET, readAllPages } from "./pages";

let server: Server | null = null;
const urls: string[] = [];

async function serve(answer: (call: number) => unknown): Promise<void> {
  const instance = createServer((req, res) => {
    urls.push(req.url ?? "");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(answer(urls.length)));
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  setConnection({
    baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
    token: "jwt-1",
  });
}

afterEach(async () => {
  urls.length = 0;
  setConnection(null);
  const instance = server;
  server = null;
  if (instance === null) return;
  await new Promise<void>((resolve) => {
    instance.close(() => resolve());
    instance.closeAllConnections();
  });
});

describe("readAllPages", () => {
  it("follows each cursor until the last page", async () => {
    await serve((call) =>
      call === 1 ? { items: [1, 2], nextCursor: "c2" } : { items: [3], nextCursor: null },
    );

    expect(await readAllPages<number>("/api/list", { kind: "dependency" })).toEqual([1, 2, 3]);
    expect(urls).toEqual([
      "/api/list?kind=dependency&limit=1000",
      "/api/list?kind=dependency&limit=1000&cursor=c2",
    ]);
  });

  it("refuses a repeated cursor", async () => {
    await serve((call) => ({ items: [call], nextCursor: call === 1 ? "c2" : "c2" }));

    await expect(readAllPages<number>("/api/list")).rejects.toThrow(
      "The daemon repeated a page cursor.",
    );
    expect(urls).toHaveLength(2);
  });

  it("stops at the page budget", async () => {
    await serve((call) => ({ items: [], nextCursor: `c${call}` }));

    await expect(readAllPages<number>("/api/list")).rejects.toThrow("The list holds more than");
    expect(urls).toHaveLength(PAGE_BUDGET);
  });
});
