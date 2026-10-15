import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type {
  MissionControlResult,
  MissionExternalAction,
  MissionProposal,
  MissionRunnableNode,
  NodeState,
  SchedulerExecutionRecord,
} from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import type { Resource } from "@/hooks/use-resource";
import { NodeControls } from "./node-controls";
import { textContent } from "../../../../../test/text-content";

const TEAM: MissionRunnableNode = {
  id: "node_team",
  kind: "initiative",
  filename: "team.md",
  mission_id: "mission_1",
  parent_id: null,
  visible_revision: 1,
  content: {
    name: "Team workspaces",
    requirement: "r",
    criterion: "c",
    verifications: ["v"],
    bindings: [],
  },
  retired_at: null,
  pinned_by_attempts: [2],
  state: "Blocked",
  attempt: 2,
  priority: 0,
  depends_on: [],
};

const OPEN: MissionProposal = {
  id: "proposal_open",
  node_id: "node_team",
  attempt: 2,
  assessment_id: "assessment_2",
  content: {
    objective_id: "node_invite",
    name: "Send the invite email in the workspace language",
    requirement: "r",
    criterion: "c",
    task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
  },
  objective_node_id: null,
  approved_at: null,
  created_at: 0,
};

function requested(resolution: MissionExternalAction["resolution"]): MissionExternalAction {
  return {
    node_id: "node_team",
    attempt: 2,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main" },
    },
    requested: true,
    request_evidence_id: "evidence_1",
    resolution,
  };
}

function answered(
  data: readonly MissionExternalAction[] = [],
): Resource<readonly MissionExternalAction[]> {
  return { data, error: null, loading: false, reload: vi.fn() };
}

function ended(overrides: Partial<SchedulerExecutionRecord> = {}): SchedulerExecutionRecord {
  return {
    execution_id: "execution_1",
    project_id: "prj-1",
    node_id: "node_team",
    claimant: {
      worker_binding_id: "binding_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_instance_01",
    },
    attempt: 2,
    pinned_revision: 1,
    node_branch: "kanthord/node_team",
    credentials: [],
    agent_selections: [],
    claim_state: "finished",
    expired_at: 9_000,
    created_at: 1_000,
    ended_at: 2_000,
    stop: null,
    trace_id: "0".repeat(31) + "1",
    root_span_id: "0".repeat(15) + "1",
    ...overrides,
  };
}

function runs(
  data: readonly SchedulerExecutionRecord[] = [],
): Resource<readonly SchedulerExecutionRecord[]> {
  return { data, error: null, loading: false, reload: vi.fn() };
}

function mount(
  node: MissionRunnableNode = TEAM,
  proposals: readonly MissionProposal[] = [],
  onChanged = vi.fn(),
  actions: Resource<readonly MissionExternalAction[]> = answered(),
  executions: Resource<readonly SchedulerExecutionRecord[]> = runs(),
) {
  render(
    <NodeControls
      node={node}
      nodes={[node]}
      missionVersion={9}
      proposals={proposals}
      actions={actions}
      executions={executions}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

describe("NodeControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.unblockNode).mockResolvedValue({} as MissionControlResult);
    vi.mocked(missionApi.discardNode).mockResolvedValue({} as MissionControlResult);
    vi.mocked(missionApi.overrideNode).mockResolvedValue({} as MissionControlResult);
    vi.mocked(missionApi.resumeNode).mockResolvedValue({} as MissionControlResult);
  });

  it("offers Unblock and Discard for a Blocked node", () => {
    mount();

    const controls = screen.getByRole("region", { name: "Controls" });
    expect(within(controls).getByRole("button", { name: "Unblock" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Discard" })).toBeTruthy();
  });

  it.each<NodeState>(["Available", "Executing"])(
    "offers Override and Discard but not Unblock or Resume for a %s node",
    (state) => {
      mount({ ...TEAM, state });

      expect(screen.queryByRole("button", { name: "Unblock" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
      expect(screen.getByRole("button", { name: "Override" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    },
  );

  it("offers Resume, Override and Discard for a Paused node", () => {
    mount({ ...TEAM, state: "Paused" });

    expect(screen.queryByRole("button", { name: "Unblock" })).toBeNull();
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Override" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
  });

  it("holds the controls of a Paused node while the executions load", () => {
    mount({ ...TEAM, state: "Paused" }, [], vi.fn(), answered(), {
      data: null,
      error: null,
      loading: true,
      reload: vi.fn(),
    });

    expect(
      screen.getByText("Reading the executions and the external actions of attempt 2."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Override" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("overrides a Blocked node with the result success after the reason", async () => {
    const { onChanged } = mount();

    await userEvent.click(screen.getByRole("button", { name: "Override" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        textContent(
          "Override records a success outcome for Team workspaces on your authority and ends it as Completed. Nodes that depend on it can start. No commit is recorded. An override cannot be undone.",
        ),
      ),
    ).toBeTruthy();
    expect(within(dialog).getByText("To run it again, unblock it.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Override node" })).toHaveProperty(
      "disabled",
      true,
    );
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Verified by hand.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Override node" }));

    expect(missionApi.overrideNode).toHaveBeenCalledWith("node_team", {
      reason: "Verified by hand.",
      expected_mission_version: 9,
      expected_state: "Blocked",
      expected_attempt: 2,
      result: "success",
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("resumes a Paused node to Available by default and sends the target", async () => {
    const { onChanged } = mount({ ...TEAM, state: "Paused" });

    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(textContent("Resume returns Team workspaces to Available.")),
    ).toBeTruthy();
    expect(within(dialog).getByText("To keep it held, cancel.")).toBeTruthy();
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Try again.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Resume node" }));

    expect(missionApi.resumeNode).toHaveBeenCalledWith("node_team", {
      reason: "Try again.",
      expected_mission_version: 9,
      expected_state: "Paused",
      expected_attempt: 2,
      target: "Available",
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("defaults the resume of a Further-work pause to Waiting", async () => {
    mount(
      { ...TEAM, state: "Paused" },
      [],
      vi.fn(),
      answered(),
      runs([ended({ stop: { reason: "budget_end", code: "turns" } })]),
    );

    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText(
        textContent("Resume returns Team workspaces to Waiting for its evaluation."),
      ),
    ).toBeTruthy();
  });

  it("holds Discard of a Paused node while the external actions load", () => {
    mount({ ...TEAM, state: "Paused" }, [], vi.fn(), {
      data: null,
      error: null,
      loading: true,
      reload: vi.fn(),
    });

    expect(
      screen.getByText("Reading the executions and the external actions of attempt 2."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("names a failed external action read and offers Retry", async () => {
    const reload = vi.fn();
    mount({ ...TEAM, state: "Paused" }, [], vi.fn(), {
      data: null,
      error: new ApiError("unreachable", "The daemon did not answer.", 0),
      loading: false,
      reload,
    });

    expect(
      screen.getByText(
        "The executions or the external actions of attempt 2 could not be read: The daemon did not answer.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("states why a Paused node with an unresolved request has no Discard", () => {
    mount({ ...TEAM, state: "Paused" }, [], vi.fn(), answered([requested("unresolved")]));

    expect(
      screen.getByText(
        "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it.each<NodeState>(["Completed", "Discarded", "External.Requested"])(
    "offers no control for a %s node",
    (state) => {
      mount({ ...TEAM, state });

      expect(screen.queryByRole("region", { name: "Controls" })).toBeNull();
    },
  );

  it("offers no control for a retired node", () => {
    mount({ ...TEAM, retired_at: 1 });

    expect(screen.queryByRole("region", { name: "Controls" })).toBeNull();
  });

  it("unblocks after the confirm, states the rejected proposals and refetches", async () => {
    const { onChanged } = mount(TEAM, [OPEN]);

    await userEvent.click(screen.getByRole("button", { name: "Unblock" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        textContent(
          "Unblock rejects the open proposals: Send the invite email in the workspace language. They stay recorded, but the initiative runs the next attempt without the fix objective.",
        ),
      ),
    ).toBeTruthy();
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Retry without the fix.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Unblock node" }));

    expect(missionApi.unblockNode).toHaveBeenCalledWith("node_team", {
      blocked_attempt: 2,
      expected_revision: 1,
      expected_mission_version: 9,
      reason: "Retry without the fix.",
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("keeps Discard node disabled until the reason holds text", async () => {
    const { onChanged } = mount();

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("A discarded node satisfies no dependency", { exact: false }),
    ).toBeTruthy();
    expect(within(dialog).getByText("Fill Reason to discard.")).toBeTruthy();
    const action = within(dialog).getByRole("button", { name: "Discard node" });
    expect(action).toHaveProperty("disabled", true);

    await userEvent.type(within(dialog).getByLabelText("Reason"), "The workspace feature moves.");
    expect(action).toHaveProperty("disabled", false);
    await userEvent.click(action);

    expect(missionApi.discardNode).toHaveBeenCalledWith("node_team", {
      reason: "The workspace feature moves.",
      expected_mission_version: 9,
      expected_state: "Blocked",
      expected_attempt: 2,
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("shows the message of a state conflict and refetches", async () => {
    vi.mocked(missionApi.discardNode).mockRejectedValue(
      new ApiError("conflict", "State conflict.", 409, "mission.node.state_conflict"),
    );
    const { onChanged } = mount();

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard node" }));

    expect(await within(dialog).findByRole("alert")).toHaveProperty(
      "textContent",
      "The state or the attempt of the node changed after this read. The view now shows its current state. Review it and discard again.",
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
