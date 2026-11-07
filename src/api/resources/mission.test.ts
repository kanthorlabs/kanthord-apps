import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  applyMissionImport,
  checkNode,
  createFinding,
  createMissionNode,
  decideFinding,
  decideFollowup,
  decideProposals,
  discardNode,
  doneInboxItem,
  exportMissionJson,
  getFinding,
  listInboxItems,
  listMissionDependencies,
  listMissionNodes,
  listNodeAssessments,
  listNodeEvidence,
  listNodeFindings,
  listNodeLinkUpdates,
  listNodeOutcomes,
  listNodeProposals,
  listProjectFollowups,
  listUndecidedFindings,
  overrideNode,
  pauseNode,
  previewMissionImport,
  readMission,
  readNodeRevision,
  removeDependency,
  resumeNode,
  unblockNode,
  updateFinding,
  updateMissionNode,
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
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });
});

describe("mission graph resources", () => {
  it("reads every node of a mission through mission.node.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listMissionNodes("mission_1");
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/node?limit=1000");
  });

  it("reads the dependency edges through mission.edge.list without a kind query", async () => {
    await serve({ items: [], next_cursor: null });

    await listMissionDependencies("mission_1");
    expect(seen[0]?.req.url).toBe("/api/mission/mission_1/edge?limit=1000");
  });

  it("reads the evidence of one attempt through mission.evidence.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeEvidence("node_1", 2);
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/evidence?attempt=2&limit=1000");
  });

  it("reads the evidence and the outcomes of every attempt when no attempt is given", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeEvidence("node_1");
    await listNodeOutcomes("node_1");
    expect(seen.map((item) => item.req.url)).toEqual([
      "/api/mission/node/node_1/evidence?limit=1000",
      "/api/mission/node/node_1/outcome?limit=1000",
    ]);
  });

  it("reads one revision through mission.node.revision.get", async () => {
    await serve({});

    await readNodeRevision("node_1", 3);
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/revision/3");
  });
});

describe("mission link update resources", () => {
  it("reads every link update of a node through mission.link_update.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeLinkUpdates("node_1");
    expect(seen[0]?.req.method).toBe("GET");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/link-update?limit=1000");
  });

  it("follows the cursor of the page in the order of the read", async () => {
    const pages = [
      { items: [{ id: "link_update_2" }], next_cursor: "cursor_1" },
      { items: [{ id: "link_update_1" }], next_cursor: null },
    ];
    const instance = createServer((req, res) => {
      seen.push({ req, body: "" });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(pages[seen.length - 1]));
    });
    server = instance;
    await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
    setConnection({
      baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
      token: "jwt-1",
    });

    const updates = await listNodeLinkUpdates("node_1");

    expect(seen.map((item) => item.req.url)).toEqual([
      "/api/mission/node/node_1/link-update?limit=1000",
      "/api/mission/node/node_1/link-update?limit=1000&cursor=cursor_1",
    ]);
    expect(updates.map((update) => update.id)).toEqual(["link_update_2", "link_update_1"]);
  });
});

describe("mission inbox resources", () => {
  const list = { items: [], next_cursor: null, counts: { open: 0, snoozed: 0 } };

  it("lists the open threads through mission.inbox_item.list", async () => {
    await serve(list);

    const answer = await listInboxItems({
      state: "open",
      projectId: null,
      limit: 100,
      cursor: null,
    });

    expect(seen[0]?.req.method).toBe("GET");
    expect(seen[0]?.req.url).toBe("/api/mission/inbox-item?state=open&limit=100");
    expect(answer).toEqual(list);
  });

  it("sends the project id and the cursor", async () => {
    await serve(list);

    await listInboxItems({ state: "open", projectId: "project_1", limit: 100, cursor: "cursor_1" });

    expect(seen[0]?.req.url).toBe(
      "/api/mission/inbox-item?state=open&project_id=project_1&limit=100&cursor=cursor_1",
    );
  });

  it("marks a thread done with a null snooze and an idempotency key", async () => {
    await serve({ link_update_id: "link_update_1", state: "done" });

    await doneInboxItem("link_update_1", { snoozed_until: null });

    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/inbox-item/link_update_1/done");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ snoozed_until: null });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });

  it("snoozes a thread with a time", async () => {
    await serve({ link_update_id: "link_update_1", state: "snoozed" });

    await doneInboxItem("link_update_1", { snoozed_until: 1_700_000_000_000 });

    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ snoozed_until: 1_700_000_000_000 });
  });
});

describe("mission node update resource", () => {
  it("patches the node through mission.node.update with an idempotency key", async () => {
    await serve({ mission_version: 5, revisions: [] });
    const body = {
      expected_mission_version: 4,
      content: {
        name: "Fix login",
        requirement: "Fix it.",
        criterion: "It works.",
        verifications: ["pnpm test"],
        bindings: ["binding_1"],
        intent: "implement" as const,
        tags: [],
      },
      tasks: [],
      reason: "Link the thread.",
    };

    await updateMissionNode("node_1", body);

    expect(seen[0]?.req.method).toBe("PATCH");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual(body);
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });
});

describe("mission follow-up resources", () => {
  it("reads every open follow-up proposal of a project through mission.followup.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listProjectFollowups("project_1");
    expect(seen[0]?.req.method).toBe("GET");
    expect(seen[0]?.req.url).toBe("/api/mission/project/project_1/followup?limit=1000");
  });

  it("follows the cursor of the follow-up page", async () => {
    const pages = [
      { items: [{ id: "proposal_1" }], next_cursor: "cursor_1" },
      { items: [{ id: "proposal_2" }], next_cursor: null },
    ];
    const instance = createServer((req, res) => {
      seen.push({ req, body: "" });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(pages[seen.length - 1]));
    });
    server = instance;
    await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
    setConnection({
      baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
      token: "jwt-1",
    });

    const proposals = await listProjectFollowups("project_1");

    expect(seen.map((item) => item.req.url)).toEqual([
      "/api/mission/project/project_1/followup?limit=1000",
      "/api/mission/project/project_1/followup?limit=1000&cursor=cursor_1",
    ]);
    expect(proposals.map((proposal) => proposal.id)).toEqual(["proposal_1", "proposal_2"]);
  });

  it("approves a follow-up proposal with the optional fields and an idempotency key", async () => {
    await serve({});

    await decideFollowup("node_1", {
      expected_mission_version: 7,
      approve: true,
      requirement: "Reply on the issue",
      criterion: "The issue holds the reply",
      reason: "Worth doing",
    });

    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/followup/decide");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      expected_mission_version: 7,
      approve: true,
      requirement: "Reply on the issue",
      criterion: "The issue holds the reply",
      reason: "Worth doing",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });

  it("rejects a follow-up proposal with approve false", async () => {
    await serve({});

    await decideFollowup("node_1", { expected_mission_version: 7, approve: false });

    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      expected_mission_version: 7,
      approve: false,
    });
  });
});

describe("mission proposal resources", () => {
  it("reads every proposal of an examine node through mission.proposal.list", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeProposals("node_1");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/proposal?limit=1000");
  });

  it("decides the proposals of an assessment with the approved identities and an idempotency key", async () => {
    await serve({});

    await decideProposals("assessment_1", {
      expected_mission_version: 7,
      approved_proposal_ids: ["proposal_1", "proposal_3"],
      reason: "Fix it",
    });
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/assessment/assessment_1/decide");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      expected_mission_version: 7,
      approved_proposal_ids: ["proposal_1", "proposal_3"],
      reason: "Fix it",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
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
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
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
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });

  it("pauses a node with the reason, the expected state and attempt and an idempotency key", async () => {
    await serve({});

    await pauseNode("node_1", {
      reason: "Hold the work",
      expected_mission_version: 7,
      expected_state: "Executing",
      expected_attempt: 2,
    });

    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/pause");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      reason: "Hold the work",
      expected_mission_version: 7,
      expected_state: "Executing",
      expected_attempt: 2,
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });

  it("resumes a node with the target, the expected state and attempt and an idempotency key", async () => {
    await serve({});

    await resumeNode("node_1", {
      reason: "Accept the work",
      expected_mission_version: 7,
      expected_state: "Paused",
      expected_attempt: 2,
      target: "Waiting",
    });

    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/resume");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      reason: "Accept the work",
      expected_mission_version: 7,
      expected_state: "Paused",
      expected_attempt: 2,
      target: "Waiting",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });

  it("overrides a node with the result success and an idempotency key", async () => {
    await serve({});

    await overrideNode("node_1", {
      reason: "Verified by hand",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
      result: "success",
    });

    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/override");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      reason: "Verified by hand",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
      result: "success",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });

  it("checks a node with only the expected mission version and answers results and failures", async () => {
    const answer = {
      results: [
        {
          evidence_id: "evidence_1",
          requirement_key: "repo.pull_request",
          resolution: "unresolved",
        },
      ],
      failures: [],
    };
    await serve(answer);

    const checked = await checkNode("node_1", { expected_mission_version: 7 });

    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/check");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ expected_mission_version: 7 });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
    expect(checked).toEqual(answer);
  });

  it("removes a dependency with a DELETE body and an idempotency key", async () => {
    await serve({ mission_version: 8 });

    const change = await removeDependency("node_1", "node_2", {
      reason: "The dependency is gone",
      expected_mission_version: 7,
    });

    expect(change).toEqual({ mission_version: 8 });
    expect(seen[0]?.req.method).toBe("DELETE");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/dependency/node_2");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      reason: "The dependency is gone",
      expected_mission_version: 7,
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });
});

describe("createMissionNode", () => {
  it("createMissionNode posts the body to the node route of the mission", async () => {
    await serve({ mission_version: 4 });
    const body = {
      filename: "suite-pass-setup-repo.md",
      content: {
        name: "Add the suite pass record",
        requirement: "r",
        criterion: "c",
        verifications: ["v"],
        bindings: ["binding_1"],
      },
      tasks: [],
      reason: "Add the suite pass record to repo.",
      expected_mission_version: 3,
    };

    const change = await createMissionNode("mission/1", body);

    expect(change).toEqual({ mission_version: 4 });
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/mission%2F1/node");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual(body);
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(
      /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/,
    );
  });
});

describe("mission finding resources", () => {
  const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

  it("lists the findings of one attempt of a node", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeFindings("node_1", 2);
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/finding?attempt=2&limit=1000");
  });

  it("lists the assessments of every attempt of a node when no attempt is given", async () => {
    await serve({ items: [], next_cursor: null });

    await listNodeAssessments("node_1");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/assessment?limit=1000");
  });

  it("gets one finding", async () => {
    await serve({});

    await getFinding("finding_1");
    expect(seen[0]?.req.method).toBe("GET");
    expect(seen[0]?.req.url).toBe("/api/mission/finding/finding_1");
  });

  it("lists the undecided findings of a project", async () => {
    await serve({ items: [], next_cursor: null });

    await listUndecidedFindings("project_1");
    expect(seen[0]?.req.url).toBe("/api/mission/project/project_1/undecided-finding?limit=1000");
  });

  it("decides a finding with the decision, the reason and an idempotency key", async () => {
    await serve({});

    await decideFinding("finding_1", { decision: "dismissed", decision_reason: "No defect." });
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/finding/finding_1/decide");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      decision: "dismissed",
      decision_reason: "No defect.",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });

  it("creates a human finding on a node with an idempotency key", async () => {
    await serve({});
    const body = {
      expected_mission_version: 4,
      assessment_id: "assessment_1",
      kind: "blocker" as const,
      task_id: null,
      name: "Reset link reuse",
      description: "A reset link works twice.",
      fix: "Mark the link used.",
      why: "A second use resets the password of another session.",
      cause_owner: "reviewer" as const,
    };

    await createFinding("node_1", body);
    expect(seen[0]?.req.method).toBe("POST");
    expect(seen[0]?.req.url).toBe("/api/mission/node/node_1/finding");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual(body);
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });

  it("updates a human finding with PATCH and an idempotency key", async () => {
    await serve({});

    await updateFinding("finding_1", { expected_mission_version: 4, cause_owner: "plan" });
    expect(seen[0]?.req.method).toBe("PATCH");
    expect(seen[0]?.req.url).toBe("/api/mission/finding/finding_1");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      expected_mission_version: 4,
      cause_owner: "plan",
    });
    expect(seen[0]?.req.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });
});
