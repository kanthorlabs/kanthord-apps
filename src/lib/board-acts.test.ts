import { describe, expect, it, vi } from "vitest";

import type { MissionEvidence, Project } from "@/api/types";

import type { ToolApprovalItem } from "./approval-attention";
import type {
  AttentionDetails,
  DecisionAttentionItem,
  DiscardedDependency,
  OutsideAttentionItem,
} from "./attention";
import {
  type BoardAct,
  credentialOf,
  credentialRefusedActsOf,
  type DecisionActControls,
  decisionActsOf,
  environmentFailedActsOf,
  fixTargetActsOf,
  needsOf,
  outsideActsOf,
  outsideReadOf,
  projectPausedActsOf,
  toolApprovalActsOf,
} from "./board-acts";
import type { BoardGate } from "./board-items";
import type {
  CredentialRefusedItem,
  EnvironmentFailedItem,
  FixAttentionItem,
  ProjectPausedItem,
} from "./fix-attention";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const GATE: BoardGate = {
  itemId: "credential_refused:openai-main",
  need: "Rotate openai-main in Fix setup",
  short: "Rotate openai-main",
};

function decisionOf(
  kind: DecisionAttentionItem["kind"],
  discarded: readonly Partial<DiscardedDependency>[] = [],
): DecisionAttentionItem {
  return { kind, discarded } as unknown as DecisionAttentionItem;
}

function controlsOf(
  overrides: Partial<DecisionActControls> = {},
  availability = true,
): DecisionActControls {
  const control = { available: availability, request: vi.fn() };
  return {
    unblock: control,
    decide: control,
    override: control,
    resume: control,
    discard: control,
    remove: { available: availability, request: vi.fn() },
    check: { available: availability, checking: false, label: null, check: vi.fn() },
    ready: true,
    lastTraceId: null,
    ...overrides,
  };
}

function idsOf(acts: readonly BoardAct[]): readonly string[] {
  return acts.map((act) => act.id);
}

function outsideOf(evidence: MissionEvidence | null): OutsideAttentionItem {
  return { request: { action: {}, evidence }, node: { id: "node_1", attempt: 2 } } as never;
}

function pullRequestOf(resourceIdentity: string, number: number): MissionEvidence {
  return {
    assets: [
      {
        kind: "platform",
        address: { kind: "pull_request", resource_identity: resourceIdentity, number },
      },
    ],
  } as unknown as MissionEvidence;
}

const READY_CHECK = { available: true, checking: false, label: null, check: vi.fn() };

describe("decisionActsOf", () => {
  it("orders the acts of a paused node", () => {
    const acts = decisionActsOf(
      decisionOf("paused"),
      controlsOf({ lastTraceId: "trace 1", check: { ...READY_CHECK, label: "Checked" } }),
      null,
    );
    expect(idsOf(acts)).toEqual([
      "resume",
      "override",
      "check",
      "check_badge",
      "last_trace",
      "discard",
    ]);
  });

  it("puts a gated resume and a jump in place of Resume when the credential gate holds", () => {
    const jump = vi.fn();
    const acts = decisionActsOf(decisionOf("paused"), controlsOf(), { gate: GATE, jump });
    expect(idsOf(acts)).toEqual(["resume", "goto", "override", "check", "discard"]);
    expect(acts[0]).toMatchObject({
      type: "gated",
      need: "Resume needs: Rotate openai-main in Fix setup.",
      reason: "Rotate openai-main in Fix setup.",
    });
    expect(acts[1]).toMatchObject({ type: "button", label: "Go to openai-main" });
    if (acts[1]?.type === "button") acts[1].press();
    expect(jump).toHaveBeenCalledWith(GATE.itemId);
  });

  it("orders the acts of a blocked node", () => {
    expect(idsOf(decisionActsOf(decisionOf("blocked"), controlsOf(), null))).toEqual([
      "decide",
      "unblock",
      "override",
      "check",
      "discard",
    ]);
  });

  it("orders one removal per discarded dependency before the check of a dependency_discarded node", () => {
    const item = decisionOf("dependency_discarded", [
      { id: "dep_1", name: "alpha" },
      { id: "dep_2", name: "beta" },
    ]);
    const controls = controlsOf({ lastTraceId: "trace_1" });
    const acts = decisionActsOf(item, controls, null);
    expect(idsOf(acts)).toEqual(["remove:dep_1", "remove:dep_2", "check", "last_trace", "discard"]);
    expect(acts[1]).toMatchObject({ ariaLabel: "Remove dependency on beta" });
    expect(acts[3]).toMatchObject({ type: "link", to: "/traces/trace_1" });
    if (acts[1]?.type === "button") acts[1].press();
    expect(controls.remove.request).toHaveBeenCalledWith({ id: "dep_2", name: "beta" });
  });

  it("omits an act that the node cannot serve", () => {
    const controls = controlsOf({ check: { ...READY_CHECK, available: false } }, false);
    expect(idsOf(decisionActsOf(decisionOf("paused"), controls, null))).toEqual([]);
  });

  it("marks Discard destructive and disables Check now while it runs", () => {
    const acts = decisionActsOf(
      decisionOf("paused"),
      controlsOf({ check: { ...READY_CHECK, checking: true } }),
      null,
    );
    expect(acts.find((act) => act.id === "discard")).toMatchObject({ variant: "destructive" });
    expect(acts.find((act) => act.id === "check")).toMatchObject({ disabled: true });
  });

  it.each([
    ["blocked", ["decide", "unblock", "discard"], "the proposals read"],
    [
      "paused",
      ["resume", "override", "check", "discard"],
      "the executions and external actions read",
    ],
    ["dependency_discarded", ["remove:dep_1", "check", "discard"], "the external actions read"],
  ] as const)("gates the acts of a %s node until its read is ready", (kind, gated, read) => {
    const item = decisionOf(kind, [{ id: "dep_1", name: "alpha" }]);
    const acts = decisionActsOf(item, controlsOf({ ready: false }), null);
    const gates = acts.filter((act) => act.type === "gated");
    expect(idsOf(gates)).toEqual(expect.arrayContaining([...gated]));
    expect(gates.every((act) => act.type === "gated" && act.need.endsWith(`needs: ${read}.`))).toBe(
      true,
    );
  });

  it("keeps Override and the trace ungated on a blocked node", () => {
    const acts = decisionActsOf(
      decisionOf("blocked"),
      controlsOf({ ready: false, lastTraceId: "t" }),
      null,
    );
    expect(acts.find((act) => act.id === "override")?.type).toBe("button");
    expect(acts.find((act) => act.id === "last_trace")?.type).toBe("link");
  });
});

describe("outsideActsOf", () => {
  it("opens a GitHub pull request before Check now", () => {
    const item = outsideOf(pullRequestOf("repository:github:kanthorlabs/kanthord", 12));
    const acts = outsideActsOf(item, READY_CHECK, null);
    expect(idsOf(acts)).toEqual(["open_pull_request", "check"]);
    expect(acts[0]).toMatchObject({
      type: "external",
      href: "https://github.com/kanthorlabs/kanthord/pull/12",
    });
  });

  it("offers no pull request link for another platform", () => {
    const item = outsideOf(pullRequestOf("repository:gitlab:group/project", 12));
    expect(idsOf(outsideActsOf(item, READY_CHECK, null))).toEqual(["check"]);
  });

  it("offers no pull request link without evidence", () => {
    expect(idsOf(outsideActsOf(outsideOf(null), READY_CHECK, null))).toEqual(["check"]);
  });

  it("gates Check now while the read waits", () => {
    const read = { text: "t", failed: false, retry: vi.fn() };
    const acts = outsideActsOf(outsideOf(null), READY_CHECK, read);
    expect(acts).toEqual([
      expect.objectContaining({
        type: "gated",
        id: "check",
        need: "Check now needs: the external actions read.",
      }),
    ]);
  });
});

describe("outsideReadOf", () => {
  it("waits for the read of the external actions", () => {
    const retry = vi.fn();
    const read = outsideReadOf(outsideOf(null), new Map() as AttentionDetails, retry);
    expect(read).toMatchObject({
      text: "Reading the external actions of attempt 2. The acts show after the read.",
      failed: false,
    });
    read?.retry();
    expect(retry).toHaveBeenCalledWith("node_1");
  });
});

describe("toolApprovalActsOf", () => {
  const item = {
    id: "tool_approval:1",
    kind: "tool_approval",
    conversationId: "conv 1",
  } as unknown as ToolApprovalItem;

  it("orders Approve, Reject and Open chat", () => {
    const acts = toolApprovalActsOf(item, {
      need: null,
      sending: true,
      approve: vi.fn(),
      reject: vi.fn(),
    });
    expect(idsOf(acts)).toEqual(["approve", "reject", "open_chat"]);
    expect(acts[0]).toMatchObject({ type: "button", disabled: true });
  });

  it("gates Approve with the need of the tool", () => {
    const acts = toolApprovalActsOf(item, {
      need: "Approve needs a grant.",
      sending: false,
      approve: vi.fn(),
      reject: vi.fn(),
    });
    expect(acts[0]).toMatchObject({ type: "gated", need: "Approve needs a grant." });
  });
});

describe("fix acts", () => {
  const credential = {
    kind: "credential_refused",
    project: PROJECT,
    credential: "openai-main",
  } as unknown as CredentialRefusedItem;

  const environment = {
    kind: "environment_failed",
    project: PROJECT,
  } as unknown as EnvironmentFailedItem;

  const verify = { checking: false, label: "Verified", verify: vi.fn() };

  it("orders the acts of a refused credential", () => {
    const acts = credentialRefusedActsOf(credential, { missing: null, start: vi.fn() }, verify);
    expect(idsOf(acts)).toEqual(["rotate", "verify", "verify_badge", "open"]);
    expect(acts[3]).toMatchObject({ label: "Open credential", to: "/llm/openai-main" });
  });

  it("gates Rotate with the missing part", () => {
    const acts = credentialRefusedActsOf(
      credential,
      { missing: "a new key", start: vi.fn() },
      verify,
    );
    expect(acts[0]).toMatchObject({ type: "gated", need: "Rotate needs: a new key." });
  });

  it("orders Open project before Run onboarding again", () => {
    const acts = environmentFailedActsOf(environment, { running: true, run: vi.fn() });
    expect(idsOf(acts)).toEqual(["open", "onboarding"]);
    expect(acts[0]).toMatchObject({ label: "Open project", to: "/projects/prj-1" });
    expect(acts[1]).toMatchObject({ disabled: true });
  });

  it("offers one resume act for a paused project", () => {
    const markActed = vi.fn();
    const item = { kind: "project_paused", project: PROJECT } as unknown as ProjectPausedItem;
    const acts = projectPausedActsOf(item, vi.fn(), markActed);
    expect(idsOf(acts)).toEqual(["resume_project"]);
    if (acts[0]?.type === "resume_project") acts[0].markActed("project_paused:prj-1");
    expect(markActed).toHaveBeenCalledWith("project_paused:prj-1", { id: "resume_project" });
  });

  it("offers the fix target of any other fix", () => {
    const item = { kind: "no_taker", project: PROJECT } as unknown as FixAttentionItem;
    expect(fixTargetActsOf(item)).toEqual([
      {
        type: "link",
        id: "fix_target",
        label: "Open bindings",
        to: "/projects/prj-1?tab=bindings",
      },
    ]);
  });
});

describe("needsOf", () => {
  it("lists each need once", () => {
    const gated = (need: string): BoardAct => ({
      type: "gated",
      id: need,
      label: need,
      ariaLabel: null,
      need,
    });
    expect(needsOf([gated("a"), gated("b"), gated("a")])).toEqual(["a", "b"]);
  });
});

describe("credentialOf", () => {
  it("takes the text after the first colon", () => {
    expect(credentialOf(GATE)).toBe("openai-main");
    expect(credentialOf({ ...GATE, itemId: "credential_refused:a:b" })).toBe("a:b");
  });
});
