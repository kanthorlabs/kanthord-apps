import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as schedulerApi from "@/api/resources/scheduler";
import type {
  MissionAttempt,
  MissionNodeRecord,
  MissionRevision,
  MissionRunnableNode,
  ProjectBindingRecord,
} from "@/api/types";
import { buildGraph } from "@/lib/mission-graph";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/scheduler");

import { NodeSheet } from "./node-sheet";

function runnable(
  id: string,
  kind: "initiative" | "objective",
  name: string,
  parentId: string | null,
  extra: Partial<MissionRunnableNode> = {},
): MissionRunnableNode {
  return {
    id,
    kind,
    filename: `${id}.md`,
    missionId: "mission_1",
    parentId,
    visibleRevision: 1,
    content: {
      name,
      requirement: `${name} requirement`,
      criterion: `${name} criterion`,
      verifications: ["pnpm test"],
      bindings: [],
    },
    retiredAt: null,
    pinnedByAttempts: [],
    state: "Pending",
    attempt: 0,
    priority: 0,
    dependsOn: [],
    ...extra,
  };
}

const AUDIT = runnable("node_audit", "objective", "Audit log", "node_recovery", {
  state: "Blocked",
  attempt: 1,
  visibleRevision: 2,
  content: {
    name: "Audit log",
    requirement: "Audit log requirement",
    criterion: "Audit log criterion",
    verifications: ["pnpm test"],
    bindings: ["binding_repo_2"],
  },
  blockedContext: {
    outcome: {
      id: "outcome_1",
      nodeId: "node_audit",
      attempt: 1,
      nodeRevision: 1,
      closingEvent: "assessment-not-passed",
      result: "criterion-not-met",
      assessmentId: "assessment_1",
      evidenceIds: [],
      createdAt: 0,
    },
    requests: [],
  },
});

const NODES: readonly MissionNodeRecord[] = [
  runnable("node_onboarding", "initiative", "Onboarding", null, { state: "Completed" }),
  runnable("node_recovery", "initiative", "Account recovery", null, { state: "Available" }),
  AUDIT,
  {
    id: "node_task",
    kind: "task",
    filename: "audit-task.md",
    missionId: "mission_1",
    parentId: "node_audit",
    visibleRevision: 2,
    content: {
      name: "Write the audit entry",
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
    },
    retiredAt: null,
    pinnedByAttempts: [],
  },
];

const MODEL = buildGraph(NODES, [
  { kind: "dependency", dependentId: "node_recovery", dependsOnId: "node_onboarding" },
]);

const ATTEMPT: MissionAttempt = {
  nodeId: "node_audit",
  attempt: 1,
  nodeRevision: 1,
  requiredExternalActions: [
    {
      key: "repo.pull_request",
      bindingId: "binding_repo_1",
      action: "pull_request",
      expectedEndState: "pull_request_merged",
      follows: null,
      configuration: { baseBranch: "main" },
    },
  ],
  openedAt: 0,
  closedAt: 1,
  outcomeIds: ["outcome_1"],
  openedBy: { kind: "human", account: "ulrich", name: "Ulrich" },
};

const REVISION_1: MissionRevision = {
  nodeId: "node_audit",
  filename: "node_audit.md",
  revision: 1,
  reason: "Import the plan.",
  actor: { kind: "human", account: "ulrich", name: "Ulrich" },
  createdAt: 0,
  content: { ...AUDIT.content, criterion: "Old criterion", bindings: ["binding_repo_1"] },
  change: { write: "import", previousRevision: null, changedFields: [] },
  pinnedByAttempts: [1],
};

const REVISION_2: MissionRevision = {
  ...REVISION_1,
  revision: 2,
  reason: "Move to the new binding.",
  content: AUDIT.content,
  change: { write: "node.update", previousRevision: 1, changedFields: ["criterion", "bindings"] },
  pinnedByAttempts: [],
};

function binding(id: string, revision: number): ProjectBindingRecord {
  return {
    id,
    projectId: "project_1",
    name: "kanthord-repo",
    kind: "repository",
    resourceIdentity: "repository:github:kanthorlabs/kanthord",
    revision,
    config: {},
    createdAt: 0,
    removedAt: null,
  };
}

function renderSheet(selectedId: string, onSelect = vi.fn()) {
  render(
    <NodeSheet projectId="project_1" model={MODEL} selectedId={selectedId} onSelect={onSelect} />,
  );
  return onSelect;
}

describe("NodeSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.readMissionNode).mockImplementation(async (nodeId) => {
      const node = NODES.find((item) => item.id === nodeId);
      if (node === undefined) throw new ApiError("not_found", "No such node.", 404);
      return node;
    });
    vi.mocked(projectsApi.readBinding).mockImplementation(async (_projectId, bindingId) =>
      binding(bindingId, bindingId === "binding_repo_1" ? 1 : 2),
    );
    vi.mocked(missionApi.listNodeAttempts).mockResolvedValue([ATTEMPT]);
    vi.mocked(missionApi.readNodeRevision).mockResolvedValue(REVISION_1);
    vi.mocked(missionApi.listNodeRevisions).mockResolvedValue([REVISION_2, REVISION_1]);
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([]);
    vi.mocked(missionApi.listNodeEvidence).mockResolvedValue([]);
    vi.mocked(missionApi.listNodeAssessments).mockResolvedValue([
      {
        id: "assessment_1",
        nodeId: "node_audit",
        executionId: "execution_9",
        attempt: 1,
        nodeRevision: 1,
        evidenceIds: [],
        childOutcomeIds: [],
        result: "criterion-not-met",
        rationale: "The audit entry holds no actor.",
        testedInput: null,
        actor: { kind: "execution", executionId: "execution_9", clientId: null, name: "reviewer" },
        createdAt: 0,
        currency: null,
        childNodeIds: [],
        workerVersion: "reviewer@1",
      },
    ]);
    vi.mocked(missionApi.listNodeOutcomes).mockResolvedValue([
      AUDIT.blockedContext?.outcome as NonNullable<typeof AUDIT.blockedContext>["outcome"],
    ]);
    vi.mocked(missionApi.listNodeExternalActions).mockResolvedValue([
      {
        nodeId: "node_audit",
        attempt: 1,
        action: ATTEMPT.requiredExternalActions[0] as MissionAttempt["requiredExternalActions"][0],
        requested: false,
        requestEvidenceId: null,
        resolution: "unrequested",
      },
    ]);
  });

  it("shows the blocking outcome, the state meaning and the current bindings", async () => {
    renderSheet("node_audit");

    const sheet = await screen.findByRole("dialog");
    expect(await within(sheet).findByText("The node is blocked after attempt 1.")).toBeTruthy();
    expect(within(sheet).getByText("A current assessment did not pass.")).toBeTruthy();
    const bindings = await within(sheet).findByRole("list", {
      name: "Bindings of the current revision",
    });
    expect(within(bindings).getByText("revision 2")).toBeTruthy();
  });

  it("shows the dependency closure through an ancestor", async () => {
    renderSheet("node_audit");

    const closure = await screen.findByRole("region", { name: "Dependency closure" });
    expect(within(closure).getByRole("button", { name: "Onboarding" })).toBeTruthy();
    expect(within(closure).getByText("through the ancestor Account recovery")).toBeTruthy();
    expect(
      screen.getByText("The dependency closure holds. Every node that it names is Completed."),
    ).toBeTruthy();
  });

  it("selects a related node", async () => {
    const onSelect = renderSheet("node_audit");

    const parent = await screen.findByRole("region", { name: "Parent" });
    await userEvent.click(within(parent).getByRole("button", { name: "Account recovery" }));

    expect(onSelect).toHaveBeenCalledWith("node_recovery");
  });

  it("reads an attempt in the context of its pinned revision", async () => {
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    await userEvent.click(await screen.findByRole("button", { name: "Records of attempt 1" }));

    expect(
      await screen.findByText(
        "The attempt pins revision 1. The node is now at revision 2, so the content below can differ from the current content.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Old criterion")).toBeTruthy();
    const actions = screen.getByRole("list", { name: "External actions" });
    expect(
      within(actions).getByText("pull_request on kanthord-repo revision 1, base main"),
    ).toBeTruthy();
    const outcomes = screen.getByRole("list", { name: "Outcomes" });
    expect(
      within(outcomes).getByText("Basis: criterion-not-met assessment by reviewer (execution_9)"),
    ).toBeTruthy();
  });

  it("keeps the other records when one read fails", async () => {
    vi.mocked(missionApi.listNodeEvidence).mockRejectedValue(
      new ApiError("unavailable", "The evidence read failed.", 503),
    );
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    await userEvent.click(await screen.findByRole("button", { name: "Records of attempt 1" }));

    expect(await screen.findByText("The evidence read failed.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Assessments" })).toBeTruthy();
  });

  it("shows the attempts of the objective for a task", async () => {
    renderSheet("node_task");

    expect(
      await screen.findByText(
        "A task holds no state, no attempt and no revision of its own. Its objective",
        { exact: false },
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Attempts" }));

    expect(await screen.findByText("Attempt 1")).toBeTruthy();
    expect(missionApi.listNodeAttempts).toHaveBeenCalledWith("node_audit");
  });

  it("marks the current revision", async () => {
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Revisions" }));

    const revisions = await screen.findByRole("list", { name: "Revisions" });
    const items = within(revisions).getAllByRole("listitem");
    expect(within(items[0] as HTMLElement).getByText("current")).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText("Pinned by attempt 1.")).toBeTruthy();
  });
});
