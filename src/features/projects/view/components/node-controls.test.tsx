import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type {
  MissionControlResult,
  MissionProposal,
  MissionRunnableNode,
  NodeState,
} from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

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

function mount(
  node: MissionRunnableNode = TEAM,
  proposals: readonly MissionProposal[] = [],
  onChanged = vi.fn(),
) {
  render(
    <NodeControls node={node} missionVersion={9} proposals={proposals} onChanged={onChanged} />,
  );
  return { onChanged };
}

describe("NodeControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.unblockNode).mockResolvedValue({} as MissionControlResult);
    vi.mocked(missionApi.discardNode).mockResolvedValue({} as MissionControlResult);
  });

  it("offers Unblock and Discard for a Blocked node", () => {
    mount();

    const controls = screen.getByRole("region", { name: "Controls" });
    expect(within(controls).getByRole("button", { name: "Unblock" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Discard" })).toBeTruthy();
  });

  it.each<NodeState>(["Available", "Executing", "Paused"])(
    "offers only Discard for a %s node",
    (state) => {
      mount({ ...TEAM, state });

      expect(screen.queryByRole("button", { name: "Unblock" })).toBeNull();
      expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    },
  );

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
      "The state or the attempt of the node changed after this read. The sheet now shows its current state. Review it and discard again.",
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
