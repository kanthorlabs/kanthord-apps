import { describe, expect, it } from "vitest";

import type { MissionNodeRecord, Project, WorkbenchSessionListItem } from "@/api/types";
import type { AttentionItem } from "@/lib/attention";
import type { FixAttentionItem } from "@/lib/fix-attention";

import {
  CASE_ASKS,
  CASE_REQUEST_PREFIX,
  caseRequestOf,
  FIX_ASKS,
  fixCaseRequestOf,
  isCaseConversation,
  nodeCaseRequestOf,
} from "./case-request";

const MARKER = "SECRET-NAME";

const PROJECT = {
  id: "project_01J",
  name: MARKER,
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/project_01J",
} as Project;

const NODE = {
  id: "node_01J",
  filename: MARKER,
  state: "Blocked",
} as MissionNodeRecord;

type NodeItem = Parameters<typeof nodeCaseRequestOf>[0];

const NODE_KINDS = Object.keys(CASE_ASKS) as readonly NodeItem["kind"][];

function nodeItemOf(kind: NodeItem["kind"]): NodeItem {
  return {
    id: `${kind}:${NODE.id}`,
    kind,
    group: "decisions",
    project: PROJECT,
    subject: MARKER,
    at: 1,
    node: NODE,
    nodes: [NODE],
    cause: MARKER,
  } as unknown as NodeItem;
}

const FIX_BASE = {
  id: "fix:1",
  group: "fixes",
  project: PROJECT,
  projects: [PROJECT],
  subject: MARKER,
  at: 1,
  cause: MARKER,
  nodeIds: [],
  nodeName: MARKER,
  issues: [MARKER],
  reason: MARKER,
  failure: { message: MARKER },
  count: 1,
  projectCount: 1,
};

function fixItemOf(kind: FixAttentionItem["kind"]): FixAttentionItem {
  return {
    ...FIX_BASE,
    kind,
    binding: "apps",
    bindingId: "binding_1",
    state: "Pending",
    jobCount: 3,
    agent: "coder@1",
    bindings: [
      { binding: "apps", project: PROJECT.id },
      { binding: "second", project: "project_other" },
    ],
    credential: "openai-main",
    credentials: ["openai-main"],
  } as unknown as FixAttentionItem;
}

const FIX_KINDS = Object.keys(FIX_ASKS) as readonly FixAttentionItem["kind"][];

describe("nodeCaseRequestOf", () => {
  it("covers the 7 node kinds", () => {
    expect(NODE_KINDS).toHaveLength(7);
  });

  it.each(NODE_KINDS)("builds the %s request from the node id and state only", (kind) => {
    const text = nodeCaseRequestOf(nodeItemOf(kind));

    expect(text.startsWith("Case: node ")).toBe(true);
    expect(text).toContain("`node_01J` (Blocked)");
    expect(text.endsWith(CASE_ASKS[kind])).toBe(true);
    expect(text).not.toContain(MARKER);
  });

  it("answers the exact text of a blocked node", () => {
    expect(nodeCaseRequestOf(nodeItemOf("blocked"))).toBe(
      "Case: node `node_01J` (Blocked). Explain why it is blocked and recommend how to unblock it.",
    );
  });
});

describe("fixCaseRequestOf", () => {
  it("covers the 7 Fix kinds", () => {
    expect(FIX_KINDS).toHaveLength(7);
  });

  it.each(FIX_KINDS)("builds the %s request from ids only", (kind) => {
    const text = fixCaseRequestOf(fixItemOf(kind));

    expect(text?.startsWith(`Case: fix ${kind} `)).toBe(true);
    expect(text?.endsWith(FIX_ASKS[kind].ask)).toBe(true);
    expect(text).not.toContain(MARKER);
  });

  it.each(["environment_failed", "environment_pending"] as const)(
    "holds the binding name and the project id of %s",
    (kind) => {
      expect(fixCaseRequestOf(fixItemOf(kind))).toContain(
        "binding `apps` of project `project_01J`",
      );
    },
  );

  it("answers the exact text of a failed environment", () => {
    expect(fixCaseRequestOf(fixItemOf("environment_failed"))).toBe(
      "Case: fix environment_failed binding `apps` of project `project_01J`. Explain why the environment failed and recommend the fix.",
    );
  });

  it("holds the project id, the state and the job count of no_taker", () => {
    expect(fixCaseRequestOf(fixItemOf("no_taker"))).toBe(
      "Case: fix no_taker jobs in state Pending (3) of project `project_01J`. Explain why no worker takes them and recommend the setup change.",
    );
  });

  it("holds the agent, the first binding name and the project id of agent_invalid", () => {
    const text = fixCaseRequestOf(fixItemOf("agent_invalid"));

    expect(text).toContain("agent `coder@1` in binding `apps` of project `project_01J`");
    expect(text).not.toContain("second");
  });

  it("names the credential and the agent of the spread kinds", () => {
    expect(fixCaseRequestOf(fixItemOf("credential_refused"))).toContain("credential `openai-main`");
    expect(fixCaseRequestOf(fixItemOf("request_rejected"))).toContain("agent `coder@1`");
  });

  it("names the project of a paused project", () => {
    expect(fixCaseRequestOf(fixItemOf("project_paused"))).toContain("project `project_01J`");
  });

  it("answers null for an agent_invalid item with no binding", () => {
    const item = { ...fixItemOf("agent_invalid"), bindings: [] } as unknown as FixAttentionItem;

    expect(fixCaseRequestOf(item)).toBeNull();
    expect(caseRequestOf(item)).toBeNull();
  });
});

describe("caseRequestOf", () => {
  it("routes a node item to the node request", () => {
    expect(caseRequestOf(nodeItemOf("paused"))).toBe(nodeCaseRequestOf(nodeItemOf("paused")));
  });

  it("routes a Fix item to the Fix request", () => {
    expect(caseRequestOf(fixItemOf("no_taker"))).toBe(fixCaseRequestOf(fixItemOf("no_taker")));
  });

  it("answers null for a tool_approval item", () => {
    const item = { id: "tool_approval:1", kind: "tool_approval" } as unknown as AttentionItem;

    expect(caseRequestOf(item)).toBeNull();
  });

  it("answers null for an Inbox item", () => {
    const item = {
      id: "link_update_1",
      kind: "inbox_item",
      group: "inbox",
    } as unknown as AttentionItem;

    expect(caseRequestOf(item)).toBeNull();
  });
});

describe("isCaseConversation", () => {
  const sessionOf = (firstMessage: string): WorkbenchSessionListItem => ({
    id: "s1",
    agent_name: "ops@1",
    name: null,
    created: 1,
    modified: 1,
    message_count: 1,
    first_message: firstMessage,
    run_active: false,
    pending_approval: null,
  });

  it("is true for a first message that starts with the case prefix", () => {
    expect(isCaseConversation(sessionOf(`${CASE_REQUEST_PREFIX}node \`n\` (Blocked). Ask.`))).toBe(
      true,
    );
  });

  it("is false for another first message and for an empty one", () => {
    expect(isCaseConversation(sessionOf("What needs me?"))).toBe(false);
    expect(isCaseConversation(sessionOf(""))).toBe(false);
  });
});
