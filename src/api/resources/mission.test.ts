import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  applyMissionImport,
  approveProposal,
  discardNode,
  exportMissionJson,
  listMissionDependencies,
  listMissionNodes,
  listNodeEvidence,
  listNodeProposals,
  previewMissionImport,
  readMission,
  readNodeRevision,
  unblockNode,
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
  mission_id: "mission_1",
  mission_version: 3,
  reason: "Split onboarding",
  entries: [],
};

describe("mission plan resources", () => {
  it("reads the mission of a project through mission.get", async () => {
    await serve({ id: "mission_1", project_id: "project_1", version: 3 });

    expect((await readMission("project_1")).version).toBe(3);
    expect(seen[0]?.req.url).toBe("/api/mission/project/project_1");
  });

  it("exports the JSON form through mission.export", async () => {
    await serve({ mission_id: "mission_1", mission_version: 3, entries: [] });

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
    await serve({ mission_id: "mission_1", mission_version: 4, assigned_ids: [] });

    await applyMissionImport({
      ...SNAPSHOT,
      preview_digest: "a".repeat(64),
      confirmed_retirements: ["node_1"],
    });
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/import");
    expect(JSON.parse(seen[0]?.body ?? "")).toMatchObject({
      preview_digest: "a".repeat(64),
      confirmed_retirements: ["node_1"],
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });
});

describe("mission graph resources", () => {
  it("reads every node of a mission through mission.node.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listMissionNodes("mission_1");
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/node?limit=1000");
  });

  it("reads only the dependency edges through mission.edge.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listMissionDependencies("mission_1");
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/edge?kind=dependency&limit=1000");
  });

  it("reads the evidence of one attempt through mission.evidence.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeEvidence("node_1", 2);
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/evidence?attempt=2&limit=1000");
  });

  it("reads one revision through mission.node.revision.get", async () => {
    await serve({});

    await readNodeRevision("node_1", 3);
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/revision/3");
  });
});

describe("mission proposal resources", () => {
  it("reads every proposal of an initiative through mission.proposal.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeProposals("node_1");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/proposal?limit=1000");
  });

  it("approves a proposal with the mission version and an idempotency key", async () => {
    await serve({});

    await approveProposal("proposal_1", { expected_mission_version: 7, reason: "Fix it" });
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/proposal/proposal_1/approve");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      expected_mission_version: 7,
      reason: "Fix it",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });
});

describe("mission node control resources", () => {
  it("unblocks a node with the blocked attempt, the revision, the mission version and an idempotency key", async () => {
    await serve({});

    await unblockNode("node_1", {
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
      reason: "Retry it",
    });
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/unblock");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
      reason: "Retry it",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });

  it("discards a node with the reason, the expected state and attempt and an idempotency key", async () => {
    await serve({});

    await discardNode("node_1", {
      reason: "Out of scope",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
    });
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/discard");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      reason: "Out of scope",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });
});
