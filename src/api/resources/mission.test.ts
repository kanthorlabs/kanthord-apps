import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  applyMissionImport,
  exportMissionJson,
  previewMissionImport,
  readMission,
} from "./mission";

let server: Server | null = null;
const seen: { readonly req: IncomingMessage; readonly body: string }[] = [];

async function serve(answer: unknown): Promise<void> {
  const instance = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      seen.push({ req, body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(answer));
    });
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  setConnection({
    baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
    token: "jwt-1",
  });
}

afterEach(async () => {
  seen.length = 0;
  setConnection(null);
  const instance = server;
  server = null;
  if (instance === null) return;
  await new Promise<void>((resolve) => {
    instance.close(() => resolve());
    instance.closeAllConnections();
  });
});

const SNAPSHOT = {
  format: "json" as const,
  missionId: "mission_1",
  missionVersion: 3,
  reason: "Split onboarding",
  entries: [],
};

describe("mission plan resources", () => {
  it("reads the mission of a project through mission.get", async () => {
    await serve({ id: "mission_1", projectId: "project_1", version: 3 });

    expect((await readMission("project_1")).version).toBe(3);
    expect(seen[0]?.req.url).toBe("/api/mission/project/project_1");
  });

  it("exports the JSON form through mission.export", async () => {
    await serve({ missionId: "mission_1", missionVersion: 3, entries: [] });

    await exportMissionJson("mission_1");
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/export?format=json");
  });

  it("previews without an idempotency key", async () => {
    await serve({});

    await previewMissionImport(SNAPSHOT);
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/import/preview");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual(SNAPSHOT);
    expect(seen[0]?.req.headers["idempotency-key"]).toBeUndefined();
  });

  it("applies with the digest, the confirmed retirements and an idempotency key", async () => {
    await serve({ missionId: "mission_1", missionVersion: 4, assignedIds: [] });

    await applyMissionImport({
      ...SNAPSHOT,
      previewDigest: "a".repeat(64),
      confirmedRetirements: ["node_1"],
    });
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/import");
    expect(JSON.parse(seen[0]?.body ?? "")).toMatchObject({
      previewDigest: "a".repeat(64),
      confirmedRetirements: ["node_1"],
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });
});
