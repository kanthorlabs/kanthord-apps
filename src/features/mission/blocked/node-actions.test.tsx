import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NODE_STATES, type MissionNode, type NodeState } from "@/api/types";

vi.mock("@/api/resources/mission", () => ({
  block: vi.fn(),
  discard: vi.fn(),
  overrideSuccess: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  setPriority: vi.fn(),
  unblock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { ApiError } from "@/api/errors";
import { unblock } from "@/api/resources/mission";
import { NodeActions } from "./node-actions";

const PAUSED_NODE: MissionNode = {
  id: "node-1",
  kind: "objective",
  title: "Add password reset",
  state: "Paused",
  parentId: null,
  dependsOn: [],
  goal: "A password reset flow.",
  steps: [],
  validationCriteria: [],
  verificationCommand: null,
  repositoryBindingId: null,
  priority: 0,
  attemptCounter: 1,
  currentRevisionId: "rev-1",
};

const BLOCKED_NODE: MissionNode = { ...PAUSED_NODE, state: "Blocked" };
const COMPLETED_NODE: MissionNode = { ...PAUSED_NODE, state: "Completed" };
const DISCARDED_NODE: MissionNode = { ...PAUSED_NODE, state: "Discarded" };
const EXECUTING_NODE: MissionNode = { ...PAUSED_NODE, state: "Executing" };
const EVALUATING_NODE: MissionNode = { ...PAUSED_NODE, state: "Evaluating" };
const EXTERNAL_REQUESTED_NODE: MissionNode = {
  ...PAUSED_NODE,
  state: "External.Requested",
};

const DEPENDENTS = [
  { id: "dep-1", title: "Ship the notification mail" },
  { id: "dep-2", title: "Add recovery codes" },
];

function renderActions(
  node: MissionNode,
  opts?: { dependents?: typeof DEPENDENTS; clearedAttemptId?: string },
) {
  return render(
    <NodeActions
      node={node}
      projectId="prj-1"
      dependents={opts?.dependents ?? []}
      clearedAttemptId={opts?.clearedAttemptId}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NodeActions — terminal state", () => {
  it("renders no controls for a Completed node", () => {
    renderActions(COMPLETED_NODE);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders no controls for a Discarded node", () => {
    renderActions(DISCARDED_NODE);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("NodeActions — block control", () => {
  it("is absent when the node is Blocked (not Paused)", () => {
    renderActions(BLOCKED_NODE, { clearedAttemptId: "att-1" });
    expect(screen.queryByRole("button", { name: "Block…" })).toBeNull();
  });

  it("is present when the node is Paused", () => {
    renderActions(PAUSED_NODE);
    expect(screen.getByRole("button", { name: "Block…" })).toBeInTheDocument();
  });
});

describe("NodeActions — override confirmation", () => {
  it("names the terminal consequence", async () => {
    const user = userEvent.setup();
    renderActions(BLOCKED_NODE, { clearedAttemptId: "att-1" });

    await user.click(screen.getByRole("button", { name: "Override success…" }));

    expect(await screen.findByText(/terminal and unreversible/i)).toBeInTheDocument();
    expect(screen.getByText(/every dependent node is satisfied immediately/i)).toBeInTheDocument();
    expect(screen.getByText(/closes the current attempt by force/i)).toBeInTheDocument();
  });

  it("requires a typed reason before confirming", async () => {
    const user = userEvent.setup();
    renderActions(BLOCKED_NODE, { clearedAttemptId: "att-1" });

    await user.click(screen.getByRole("button", { name: "Override success…" }));
    await screen.findByText(/terminal and unreversible/i);

    const confirmBtn = screen.getByRole("button", { name: "Confirm override" });
    expect(confirmBtn).toBeDisabled();

    await user.type(
      screen.getByLabelText(/reason for asserting success/i),
      "manual inspection passed",
    );
    expect(confirmBtn).not.toBeDisabled();
  });

  it("lists dependents that will be released", async () => {
    const user = userEvent.setup();
    renderActions(BLOCKED_NODE, { dependents: DEPENDENTS, clearedAttemptId: "att-1" });

    await user.click(screen.getByRole("button", { name: "Override success…" }));

    expect(await screen.findByText("Ship the notification mail")).toBeInTheDocument();
    expect(screen.getByText("Add recovery codes")).toBeInTheDocument();
    expect(screen.getByText(/dependents that will be released/i)).toBeInTheDocument();
  });
});

describe("NodeActions — discard confirmation", () => {
  it("names the dependents that will strand", async () => {
    const user = userEvent.setup();
    renderActions(BLOCKED_NODE, { dependents: DEPENDENTS, clearedAttemptId: "att-1" });

    await user.click(screen.getByRole("button", { name: "Discard…" }));

    expect(await screen.findByText(/dependents that will strand/i)).toBeInTheDocument();
    expect(screen.getByText("Ship the notification mail")).toBeInTheDocument();
    expect(screen.getByText("Add recovery codes")).toBeInTheDocument();
  });

  it("requires a stopping reason before confirming", async () => {
    const user = userEvent.setup();
    renderActions(BLOCKED_NODE, { clearedAttemptId: "att-1" });

    await user.click(screen.getByRole("button", { name: "Discard…" }));
    await screen.findByLabelText(/stopping reason/i);

    const confirmBtn = screen.getByRole("button", { name: "Confirm discard" });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/stopping reason/i), "work is no longer needed");
    expect(confirmBtn).not.toBeDisabled();
  });
});

describe("NodeActions — unblock conflict path", () => {
  it("tells the human their view is stale when the server returns conflict", async () => {
    vi.mocked(unblock).mockRejectedValue(
      new ApiError("conflict", "The expected revision is superseded.", 409),
    );

    const user = userEvent.setup();
    renderActions(BLOCKED_NODE, { clearedAttemptId: "att-1" });

    await user.click(screen.getByRole("button", { name: "Unblock…" }));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Unblock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/your view is stale/i)).toBeInTheDocument();
    expect(screen.getByText(/reload the page/i)).toBeInTheDocument();
  });
});

describe("NodeActions — pause control", () => {
  it("is absent when the node is Blocked", () => {
    renderActions(BLOCKED_NODE, { clearedAttemptId: "att-1" });
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });

  it("is absent when the node is Paused (Resume and Block remain present)", () => {
    renderActions(PAUSED_NODE);
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Block…" })).toBeInTheDocument();
  });
});

describe("NodeActions — set priority control", () => {
  it("is absent when the node is Executing", () => {
    renderActions(EXECUTING_NODE);
    expect(screen.queryByRole("button", { name: "Set priority" })).toBeNull();
  });

  it("is absent when the node is Evaluating", () => {
    renderActions(EVALUATING_NODE);
    expect(screen.queryByRole("button", { name: "Set priority" })).toBeNull();
  });
});

describe("NodeActions — terminal-reaching controls", () => {
  it("offers no override on an Evaluating node, because only a passing assessment completes it", () => {
    renderActions(EVALUATING_NODE);

    expect(screen.queryByRole("button", { name: /override success/i })).toBeNull();
  });

  it("offers no override on an External.Requested node, whose request-reply action is unresolved", () => {
    renderActions(EXTERNAL_REQUESTED_NODE);

    expect(screen.queryByRole("button", { name: /override success/i })).toBeNull();
  });

  it("offers no discard on an External.Requested node, whose request-reply action is unresolved", () => {
    renderActions(EXTERNAL_REQUESTED_NODE);

    expect(screen.queryByRole("button", { name: /discard/i })).toBeNull();
  });

  it("still offers discard on an Evaluating node", () => {
    renderActions(EVALUATING_NODE);

    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();
  });
});
const ADMITTED_BY: Record<string, readonly NodeState[]> = {
  Pause: [
    "Pending",
    "Available",
    "Executing",
    "Waiting",
    "Evaluating",
    "External.Requested",
    "External.Success",
    "External.Failed",
  ],
  Resume: ["Paused"],
  "Block…": ["Paused"],
  "Unblock…": ["Blocked"],
  "Override success…": [
    "Pending",
    "Available",
    "Executing",
    "Waiting",
    "Blocked",
    "Paused",
    "External.Success",
    "External.Failed",
  ],
  "Discard…": [
    "Pending",
    "Available",
    "Executing",
    "Waiting",
    "Evaluating",
    "Blocked",
    "Paused",
    "External.Success",
    "External.Failed",
  ],
};

const PRIORITY_ADMITTED_BY: readonly NodeState[] = [
  "Pending",
  "Available",
  "Waiting",
  "Blocked",
  "Paused",
  "External.Requested",
  "External.Success",
  "External.Failed",
];

describe("NodeActions — the admissibility matrix of the transition table", () => {
  for (const [control, admitted] of Object.entries(ADMITTED_BY)) {
    for (const state of NODE_STATES) {
      const shouldRender = admitted.includes(state);
      it(`${shouldRender ? "offers" : "withholds"} ${control} on a ${state} node`, () => {
        renderActions({ ...PAUSED_NODE, state });

        const control_ = screen.queryByRole("button", { name: control });
        if (shouldRender) {
          expect(control_).not.toBeNull();
        } else {
          expect(control_).toBeNull();
        }
      });
    }
  }

  for (const state of NODE_STATES) {
    const shouldRender = PRIORITY_ADMITTED_BY.includes(state);
    it(`${shouldRender ? "offers" : "withholds"} the priority control on a ${state} node`, () => {
      renderActions({ ...PAUSED_NODE, state });

      const priority = screen.queryByLabelText("Priority");
      if (shouldRender) {
        expect(priority).not.toBeNull();
      } else {
        expect(priority).toBeNull();
      }
    });
  }
});
