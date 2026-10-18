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
  ProjectBindingRecord,
  Intent,
} from "@/api/types";
import { buildGraph } from "@/lib/mission-graph";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/scheduler");

import { NodeSheet } from "./node-sheet";
import { textContent } from "../../../../../test/text-content";

function node(
  id: string,
  intent: Intent,
  name: string,
  extra: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return {
    id,
    intent,
    tags: [],
    tasks: [],
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name,
      requirement: `${name} requirement`,
      criterion: `${name} criterion`,
      verifications: ["pnpm test"],
      bindings: [],
      intent,
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state: "Pending",
    attempt: 0,
    priority: 0,
    depends_on: [],
    ...extra,
  };
}

const AUDIT = node("node_audit", "implement", "Audit log", {
  state: "Blocked",
  attempt: 1,
  visible_revision: 2,
  tags: ["platform.macos"],
  tasks: [
    {
      id: "task_entry",
      filename: "audit-task.md",
      content: {
        name: "Write the audit entry",
        requirement: "r",
        criterion: "c",
        verifications: ["v"],
        bindings: [],
      },
    },
  ],
  content: {
    name: "Audit log",
    requirement: "Audit log requirement",
    criterion: "Audit log criterion",
    verifications: ["pnpm test"],
    bindings: ["binding_repo_2"],
    intent: "implement",
    tags: ["platform.macos"],
  },
  blocked_context: {
    outcome: {
      id: "outcome_1",
      node_id: "node_audit",
      attempt: 1,
      node_revision: 1,
      closing_event: "assessment-not-passed",
      result: "criterion-not-met",
      assessment_id: "assessment_1",
      evidence_ids: [],
      created_at: 0,
    },
    requests: [],
  },
});

const HELD = node("node_held", "implement", "Held work", { state: "Paused", attempt: 0 });

const NODES: readonly MissionNodeRecord[] = [
  HELD,
  node("node_onboarding", "examine", "Onboarding", { state: "Completed" }),
  node("node_recovery", "examine", "Account recovery", { state: "Pending" }),
  AUDIT,
];

const MODEL = buildGraph(NODES, [
  { dependent_id: "node_audit", depends_on_id: "node_onboarding" },
  { dependent_id: "node_recovery", depends_on_id: "node_audit" },
]);

const ATTEMPT: MissionAttempt = {
  node_id: "node_audit",
  attempt: 1,
  node_revision: 1,
  start_point: "base_branch",
  required_external_actions: [
    {
      key: "repo.pull_request",
      binding_id: "binding_repo_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main", landing: "human" },
    },
  ],
  opened_at: 0,
  closed_at: 1,
  outcome_ids: ["outcome_1"],
  opened_by: { kind: "human", account: "ulrich", name: "Ulrich" },
};

const REVISION_1: MissionRevision = {
  node_id: "node_audit",
  filename: "node_audit.md",
  revision: 1,
  reason: "Import the plan.",
  actor: { kind: "human", account: "ulrich", name: "Ulrich" },
  created_at: 0,
  content: { ...AUDIT.content, criterion: "Old criterion", bindings: ["binding_repo_1"] },
  tasks: AUDIT.tasks,
  change: { write: "import", previous_revision: null, changed_fields: [] },
  pinned_by_attempts: [1],
};

const REVISION_2: MissionRevision = {
  ...REVISION_1,
  revision: 2,
  reason: "Move to the new binding.",
  content: AUDIT.content,
  change: { write: "node.update", previous_revision: 1, changed_fields: ["criterion", "bindings"] },
  pinned_by_attempts: [],
};

function binding(id: string, revision: number): ProjectBindingRecord {
  return {
    id,
    project_id: "project_1",
    name: "kanthord-repo",
    kind: "repository",
    resource_identity: "repository:github:kanthorlabs/kanthord",
    revision,
    config: {},
    created_at: 0,
    removed_at: null,
  };
}

function renderSheet(selectedId: string, onSelect = vi.fn()) {
  render(
    <NodeSheet
      projectId="project_1"
      model={MODEL}
      selectedId={selectedId}
      missionVersion={3}
      onChanged={vi.fn()}
      onSelect={onSelect}
    />,
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
        node_id: "node_audit",
        execution_id: "execution_9",
        attempt: 1,
        node_revision: 1,
        evidence_ids: [],
        dependency_outcome_ids: [],
        result: "criterion-not-met",
        rationale: "The audit entry holds no actor.",
        tested_input: null,
        actor: {
          kind: "execution",
          execution_id: "execution_9",
          client_id: null,
          name: "reviewer",
        },
        created_at: 0,
        currency: null,
        dependency_node_ids: [],
        worker_version: "reviewer@1",
      },
    ]);
    vi.mocked(missionApi.listNodeOutcomes).mockResolvedValue([
      AUDIT.blocked_context?.outcome as NonNullable<typeof AUDIT.blocked_context>["outcome"],
    ]);
    vi.mocked(missionApi.listNodeExternalActions).mockResolvedValue([
      {
        node_id: "node_audit",
        attempt: 1,
        action: ATTEMPT
          .required_external_actions[0] as MissionAttempt["required_external_actions"][0],
        requested: false,
        request_evidence_id: null,
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

  it("offers the controls beside the blocked notice of an implement node", async () => {
    renderSheet("node_audit");

    const controls = await screen.findByRole("region", { name: "Controls" });
    expect(within(controls).getByRole("button", { name: "Unblock" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(missionApi.listNodeProposals).not.toHaveBeenCalled();
  });

  it("offers Resume, Override and Discard for a Paused node at attempt 0 without a read", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockRejectedValue(
      new ApiError("malformed", "Request validation failed.", 400),
    );
    renderSheet("node_held");

    const controls = await screen.findByRole("region", { name: "Controls" });
    expect(within(controls).getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Override" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(schedulerApi.listNodeExecutions).not.toHaveBeenCalled();
    expect(missionApi.listNodeExternalActions).not.toHaveBeenCalled();
  });

  it("shows the intent and the tags of the node", async () => {
    renderSheet("node_audit");

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("implement · node_audit.md")).toBeTruthy();
    expect(await within(sheet).findByText("platform.macos")).toBeTruthy();
  });

  it("shows None for empty tags", async () => {
    renderSheet("node_held");

    expect(await screen.findByText("None")).toBeTruthy();
  });

  it("shows the dependencies, the dependents and the tasks of an implement node", async () => {
    renderSheet("node_audit");

    const dependsOn = await screen.findByRole("region", { name: "Depends on" });
    expect(within(dependsOn).getByRole("button", { name: "Onboarding" })).toBeTruthy();
    const dependents = screen.getByRole("region", { name: "Dependents" });
    expect(within(dependents).getByRole("button", { name: "Account recovery" })).toBeTruthy();
    const tasks = screen.getByRole("region", { name: "Tasks" });
    expect(within(tasks).getByText("Write the audit entry")).toBeTruthy();
    expect(
      screen.getByText("The dependency closure holds. Every node that it names is Completed."),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Parent" })).toBeNull();
  });

  it("shows no Tasks section for an examine node and reads its proposals", async () => {
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([]);
    renderSheet("node_recovery");

    expect(await screen.findByRole("region", { name: "Depends on" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Tasks" })).toBeNull();
    expect(missionApi.listNodeProposals).toHaveBeenCalledWith("node_recovery");
  });

  it("selects a related node", async () => {
    const onSelect = renderSheet("node_audit");

    const dependents = await screen.findByRole("region", { name: "Dependents" });
    await userEvent.click(within(dependents).getByRole("button", { name: "Account recovery" }));

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
      within(actions).getByText(textContent("pull_request on kanthord-repo revision 1, base main")),
    ).toBeTruthy();
    const outcomes = screen.getByRole("list", { name: "Outcomes" });
    expect(
      within(outcomes).getByText(
        textContent("Basis: criterion-not-met assessment by reviewer (execution_9)"),
      ),
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

  it("marks the current revision", async () => {
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Revisions" }));

    const revisions = await screen.findByRole("list", { name: "Revisions" });
    const items = within(revisions).getAllByRole("listitem");
    expect(within(items[0] as HTMLElement).getByText("current")).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText("Pinned by attempt 1.")).toBeTruthy();
  });
});
