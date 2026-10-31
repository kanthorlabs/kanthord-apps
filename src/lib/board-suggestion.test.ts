import { describe, expect, it } from "vitest";

import type { MissionAssessment, MissionNodeRecord, MissionProposal, Project } from "@/api/types";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import type { AttentionItem } from "./attention";
import type { BoardGate } from "./board-items";
import { actorNameOf, proposalSourceOf, suggestionOf } from "./board-suggestion";
import type {
  AgentInvalidItem,
  CredentialRefusedItem,
  EnvironmentFailedItem,
  NoTakerItem,
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

const NODE = { id: "node_1", attempt: 2 } as MissionNodeRecord;

const FIX_BASE = {
  group: "fixes",
  project: PROJECT,
  at: null,
  nodeIds: [],
  projects: [PROJECT],
} as const;

const CLIENT_RULE = "Source: client rule";

function paused(): AttentionItem {
  return {
    id: "paused:node_1",
    kind: "paused",
    group: "decisions",
    project: PROJECT,
    subject: "Pause",
    missionVersion: 1,
    node: NODE,
    nodes: [NODE],
    at: null,
    pause: null,
    cause: null,
  };
}

function blocked(cause: string): AttentionItem {
  return {
    id: "blocked:node_1",
    kind: "blocked",
    group: "decisions",
    project: PROJECT,
    subject: "Team",
    missionVersion: 1,
    node: NODE,
    nodes: [NODE],
    at: null,
    cause,
  };
}

const CREDENTIAL: CredentialRefusedItem = {
  ...FIX_BASE,
  id: "credential_refused:openai-main",
  kind: "credential_refused",
  subject: "openai-main",
  cause: "Credential refused",
  count: 3,
  projectCount: 1,
  credential: "openai-main",
  credentials: ["openai-main"],
  nodeName: "Team",
};

const ENVIRONMENT: EnvironmentFailedItem = {
  ...FIX_BASE,
  id: "environment_failed:prj-1:binding_1",
  kind: "environment_failed",
  subject: "main",
  cause: "Environment failed",
  binding: "main",
  bindingId: "binding_1",
  failure: null,
  failureClass: "setup_failed",
};

const PROJECT_PAUSED: ProjectPausedItem = {
  ...FIX_BASE,
  id: "project_paused:prj-1",
  kind: "project_paused",
  subject: "kanthord",
  cause: "Project paused",
};

const AGENT_INVALID = {
  ...FIX_BASE,
  id: "agent_invalid:swe",
  kind: "agent_invalid",
  subject: "swe",
  cause: "Invalid agent configuration",
  agent: "swe",
} as unknown as AgentInvalidItem;

const NO_TAKER = {
  ...FIX_BASE,
  id: "no_taker:x",
  kind: "no_taker",
  subject: "Implement jobs",
  cause: "No taker",
} as unknown as NoTakerItem;

function dependency(...names: readonly string[]): AttentionItem {
  return {
    id: "dependency_discarded:node_1",
    kind: "dependency_discarded",
    group: "decisions",
    project: PROJECT,
    subject: "Team",
    missionVersion: 1,
    node: NODE,
    nodes: [NODE],
    at: null,
    cause: "Discarded dependency",
    discarded: names.map((name) => ({ id: `id_${name}`, name })),
  };
}

const APPROVAL: ToolApprovalItem = {
  id: "tool_approval:s1",
  group: "decisions",
  kind: "tool_approval",
  subject: "Create",
  at: 2,
  sessionId: "s1",
  toolCallId: "c1",
  agent: "swe@1",
  operationId: "project.create",
};

const GATE: BoardGate = {
  itemId: "credential_refused:openai-main",
  need: "Rotate openai-main in Fix setup",
  short: "Rotate openai-main",
};

describe("suggestionOf", () => {
  it("tells a credential refusal to rotate, then resume the paused nodes", () => {
    expect(suggestionOf(CREDENTIAL, null)).toEqual({
      text: "Rotate openai-main, then resume the 3 paused nodes. A resume before the rotation spends the extra try.",
      source: CLIENT_RULE,
    });
  });

  it("uses the singular for one paused node", () => {
    expect(suggestionOf({ ...CREDENTIAL, count: 1 }, null).text).toBe(
      "Rotate openai-main, then resume the 1 paused node. A resume before the rotation spends the extra try.",
    );
  });

  it("tells a failed environment to fix the command in the repository of the binding", () => {
    expect(suggestionOf(ENVIRONMENT, null)).toEqual({
      text: "Fix the failed command in the repository of binding main. A new base commit starts a new proof. A new onboarding at the same commit fails again.",
      source: CLIENT_RULE,
    });
  });

  it.each([
    [PROJECT_PAUSED, "Open project"],
    [AGENT_INVALID, "Open agent"],
    [NO_TAKER, "Open bindings"],
  ])("names the fix target for another fix kind", (item, label) => {
    expect(suggestionOf(item, null)).toEqual({
      text: `${label}, then fix the setup that the cause names.`,
      source: CLIENT_RULE,
    });
  });

  it("tells a gated pause to do the gate need first", () => {
    expect(suggestionOf(paused(), GATE)).toEqual({
      text: "Rotate openai-main in Fix setup first. A resume before that fix spends the extra try.",
      source: CLIENT_RULE,
    });
  });

  it("tells another pause to resume the node", () => {
    expect(suggestionOf(paused(), null)).toEqual({
      text: "Resume the node. The next execution starts a new try.",
      source: CLIENT_RULE,
    });
  });

  it("tells a blocked item with criterion not met to unblock", () => {
    expect(suggestionOf(blocked("Criterion not met"), null)).toEqual({
      text: "Unblock from the node branch. The next attempt reads this outcome and its cause.",
      source: CLIENT_RULE,
    });
  });

  it("tells a blocked item with open proposals to check the first proposal", () => {
    expect(
      suggestionOf(blocked("Criterion not met"), null, { name: "Split team", reviewer: "swe@1" }),
    ).toEqual({
      text: 'Decide the proposals: check "Split team".',
      source: "Source: proposal of swe@1",
    });
  });

  it("names the reviewer generically when the assessment is unknown", () => {
    expect(
      suggestionOf(blocked("Criterion not met"), null, { name: "Split team", reviewer: null })
        .source,
    ).toBe("Source: proposal of the reviewer");
  });

  it("asks whether the work of the discarded dependency still needs to happen", () => {
    expect(suggestionOf(dependency("Alpha", "Beta"), null)).toEqual({
      text: "Does the work of Alpha, Beta still need to happen? No: remove the dependency. Yes: add a new node for that work, then remove the dependency.",
      source: CLIENT_RULE,
    });
  });

  it("tells an outside item to merge, then check", () => {
    const item = { ...paused(), kind: "merge_wait" } as unknown as AttentionItem;

    expect(suggestionOf(item, null)).toEqual({
      text: "Merge the pull request on the platform, then Check now.",
      source: CLIENT_RULE,
    });
  });

  it("tells a tool approval to approve or reject", () => {
    expect(suggestionOf(APPROVAL, null)).toEqual({
      text: "Approve if the change states what you want. Reject to return the call to the agent.",
      source: CLIENT_RULE,
    });
  });
});

describe("proposalSourceOf", () => {
  const PROPOSAL = { content: { name: "Split team" } } as MissionProposal;

  it("answers the first proposal name and the reviewer name", () => {
    const assessment = {
      actor: { kind: "execution", execution_id: "e1", client_id: null, name: "reviewer@1" },
    } as MissionAssessment;

    expect(proposalSourceOf([PROPOSAL], assessment)).toEqual({
      name: "Split team",
      reviewer: "reviewer@1",
    });
  });

  it("answers a null reviewer without an assessment", () => {
    expect(proposalSourceOf([PROPOSAL], null)).toEqual({ name: "Split team", reviewer: null });
  });

  it("answers null without a proposal", () => {
    expect(proposalSourceOf([], null)).toBeNull();
  });
});

describe("actorNameOf", () => {
  it("names a human", () => {
    expect(actorNameOf({ kind: "human", account: "ulrich", name: "Ulrich" })).toBe("Ulrich");
  });

  it("names an execution by its name, else its id", () => {
    expect(
      actorNameOf({ kind: "execution", execution_id: "e1", client_id: null, name: "swe@1" }),
    ).toBe("swe@1");
    expect(
      actorNameOf({ kind: "execution", execution_id: "e1", client_id: null, name: null }),
    ).toBe("e1");
  });

  it("names a service", () => {
    expect(actorNameOf({ kind: "service", service: "scheduler" })).toBe("scheduler service");
  });
});
