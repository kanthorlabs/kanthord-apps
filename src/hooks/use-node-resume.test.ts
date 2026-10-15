import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { resumeNode } from "@/api/resources/mission";
import type {
  MissionControlResult,
  MissionExternalAction,
  MissionNodeRecord,
  MissionRunnableNode,
  NodeState,
} from "@/api/types";
import type { PauseCause } from "@/lib/execution-stop";
import { useNodeResume } from "./use-node-resume";
import { renderedText } from "../../test/text-content";

vi.mock("@/api/resources/mission", () => ({ resumeNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const resumeMock = vi.mocked(resumeNode);

function node(
  id: string,
  name: string,
  state: NodeState,
  overrides: Partial<MissionRunnableNode> = {},
): MissionRunnableNode {
  return {
    id,
    kind: "objective",
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 2,
    content: { name, requirement: "r", criterion: "c", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    state,
    attempt: 3,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

const PAUSED = node("node_rates", "Compute the rates", "Paused");

function action(resolution: MissionExternalAction["resolution"]): MissionExternalAction {
  return {
    node_id: "node_rates",
    attempt: 3,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main" },
    },
    requested: resolution !== "unrequested",
    request_evidence_id: resolution === "unrequested" ? null : "evidence_1",
    resolution,
  };
}

interface Setup {
  readonly node?: MissionRunnableNode;
  readonly nodes?: readonly MissionNodeRecord[];
  readonly actions?: readonly MissionExternalAction[] | null;
  readonly cause?: PauseCause | null;
}

function mount({ node: target = PAUSED, nodes, actions = [], cause = null }: Setup = {}) {
  const reload = vi.fn();
  const view = renderHook(() =>
    useNodeResume(target, 7, nodes ?? [target], actions, cause, reload),
  );
  return { ...view, reload };
}

function consequence(setup: Setup): string {
  const { result } = mount(setup);
  act(() => result.current.request());
  return renderedText(result.current.consequence).text;
}

beforeEach(() => {
  resumeMock.mockReset().mockResolvedValue({} as MissionControlResult);
});

describe("useNodeResume guard", () => {
  it("offers resume for a Paused node whose external actions answered", () => {
    expect(mount().result.current.available).toBe(true);
  });

  it("holds resume until the external actions answer", () => {
    expect(mount({ actions: null }).result.current.available).toBe(false);
  });

  it.each<NodeState>(["Blocked", "Available", "Completed"])(
    "offers no resume for a %s node",
    (state) => {
      expect(
        mount({ node: node("node_rates", "Compute the rates", state) }).result.current.available,
      ).toBe(false);
    },
  );

  it("offers no resume for a retired node", () => {
    expect(mount({ node: { ...PAUSED, retired_at: 1 } }).result.current.available).toBe(false);
  });

  it("opens no dialog when the guard fails", () => {
    const { result } = mount({ actions: null });

    act(() => result.current.request());

    expect(result.current.open).toBe(false);
  });
});

describe("useNodeResume consequence", () => {
  it("moves to External.Failed and says that the attempt closes", () => {
    expect(consequence({ actions: [action("other-end")] })).toBe(
      "Resume moves Compute the rates to External.Failed, and its attempt then closes.",
    );
  });

  it("moves to External.Success when every request reached its expected end", () => {
    expect(consequence({ actions: [action("expected-end")] })).toBe(
      "Resume moves Compute the rates to External.Success.",
    );
  });

  it("returns to External.Requested while a request is open", () => {
    expect(consequence({ actions: [action("unresolved")] })).toBe(
      "Resume returns Compute the rates to External.Requested, because its request is still open.",
    );
  });

  it("returns to External.Requested when a required action holds no request", () => {
    expect(consequence({ actions: [action("expected-end"), action("unrequested")] })).toBe(
      "Resume returns Compute the rates to External.Requested, because a required action has not reached its expected end.",
    );
  });

  it("returns to Available", () => {
    expect(consequence({})).toBe("Resume returns Compute the rates to Available.");
  });

  it("returns to Pending and names the dependency that is not Completed", () => {
    const dependent = node("node_rates", "Compute the rates", "Paused", {
      depends_on: ["node_form"],
    });

    expect(
      consequence({
        node: dependent,
        nodes: [dependent, node("node_form", "Sign-up form", "Executing")],
      }),
    ).toBe("Resume returns Compute the rates to Pending, because Sign-up form is not Completed.");
  });

  it("names an unknown dependency by its identity in the regular weight", () => {
    const dependent = node("node_rates", "Compute the rates", "Paused", {
      depends_on: ["node_gone"],
    });
    const { result } = mount({ node: dependent, nodes: [dependent] });
    act(() => result.current.request());

    expect(renderedText(result.current.consequence)).toEqual({
      text: "Resume returns Compute the rates to Pending, because node_gone is not Completed.",
      bold: ["Compute the rates"],
    });
  });

  it("returns to Waiting for the evaluation at the Further-work limit", () => {
    expect(consequence({ cause: "further-work-limit" })).toBe(
      "Resume returns Compute the rates to Waiting for its evaluation.",
    );
  });
});

describe("useNodeResume target", () => {
  it("defaults to Waiting at the Further-work limit when Waiting is offered", () => {
    const { result } = mount({ cause: "further-work-limit" });
    act(() => result.current.request());

    expect(result.current.target).toBe("Waiting");
    expect(result.current.choice).toBe(true);
    expect(result.current.waitingNeeds).toBeNull();
  });

  it("defaults to Available at the Failure limit and for a human pause", () => {
    for (const cause of ["failure-limit", "human", null] as const) {
      const { result } = mount({ cause });
      act(() => result.current.request());
      expect(result.current.target).toBe("Available");
    }
  });

  it("defaults to Available and names what Waiting needs at the Further-work limit", () => {
    const dependent = node("node_rates", "Compute the rates", "Paused", {
      depends_on: ["node_form"],
    });
    const { result } = mount({
      node: dependent,
      nodes: [dependent, node("node_form", "Sign-up form", "Blocked")],
      cause: "further-work-limit",
    });
    act(() => result.current.request());

    expect(result.current.target).toBe("Available");
    expect(result.current.choice).toBe(true);
    expect(renderedText(result.current.waitingNeeds).text).toBe("Sign-up form to be Completed");
  });

  it("names an unknown dependency of a Waiting need by its identity in the regular weight", () => {
    const dependent = node("node_rates", "Compute the rates", "Paused", {
      depends_on: ["node_gone"],
    });
    const { result } = mount({ node: dependent, nodes: [dependent], cause: "further-work-limit" });
    act(() => result.current.request());

    expect(renderedText(result.current.waitingNeeds)).toEqual({
      text: "node_gone to be Completed",
      bold: [],
    });
  });

  it("sends the target that the human picks", async () => {
    const { result } = mount({ cause: "failure-limit" });

    act(() => result.current.request());
    act(() => result.current.setTarget("Waiting"));
    act(() => result.current.setReason("Accept the work"));
    await act(async () => result.current.confirm());

    expect(resumeMock).toHaveBeenCalledWith("node_rates", {
      reason: "Accept the work",
      expected_mission_version: 7,
      expected_state: "Paused",
      expected_attempt: 3,
      target: "Waiting",
    });
  });

  it("keeps Available when Waiting is picked but needs something", () => {
    const { result } = mount({ actions: [action("unresolved")], cause: "human" });

    act(() => result.current.request());
    act(() => result.current.setTarget("Waiting"));

    expect(result.current.target).toBe("Available");
  });

  it("offers no target choice when the external actions decide the end", () => {
    const { result } = mount({ actions: [action("unresolved")] });
    act(() => result.current.request());

    expect(result.current.choice).toBe(false);
  });
});

describe("useNodeResume notes", () => {
  it("adds the failure count note at the Failure limit", () => {
    const { result } = mount({ cause: "failure-limit" });
    act(() => result.current.request());

    expect(result.current.notes.map((note) => renderedText(note).text)).toEqual([
      "A resume resets no failure count, so it grants one more try.",
    ]);
  });

  it("adds the stall count note at the Further-work limit for the target Available", () => {
    const { result } = mount({ cause: "further-work-limit" });
    act(() => result.current.request());
    act(() => result.current.setTarget("Available"));

    expect(result.current.notes.map((note) => renderedText(note).text)).toEqual([
      "A resume resets no stall count. The next execution that ends at its budget pauses Compute the rates again. To accept the work done, resume to Waiting.",
    ]);
  });

  it("leaves out the Waiting sentence while a Waiting need is unmet", () => {
    const dependent = node("node_rates", "Compute the rates", "Paused", { depends_on: ["node_x"] });
    const blocker = node("node_x", "Export the orders", "Executing");
    const { result } = mount({
      node: dependent,
      nodes: [dependent, blocker],
      cause: "further-work-limit",
    });
    act(() => result.current.request());

    expect(result.current.notes.map((note) => renderedText(note).text)).toEqual([
      "A resume resets no stall count. The next execution that ends at its budget pauses Compute the rates again.",
    ]);
  });

  it.each<PauseCause>(["failure-limit", "further-work-limit"])(
    "adds no note at the %s when the end is External.Success",
    (cause) => {
      const { result } = mount({ cause, actions: [action("expected-end")] });
      act(() => result.current.request());

      expect(result.current.notes).toEqual([]);
    },
  );

  it("adds no note for the target Waiting at the Further-work limit", () => {
    const { result } = mount({ cause: "further-work-limit" });
    act(() => result.current.request());

    expect(result.current.notes).toEqual([]);
  });
});

describe("useNodeResume call", () => {
  it("requires a nonblank reason before the call", async () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("  "));
    expect(result.current.missing).toBe("Fill Reason to resume.");
    await act(async () => result.current.confirm());

    expect(resumeMock).not.toHaveBeenCalled();
  });

  it("sends the trimmed reason and reloads on success", async () => {
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("  Try again  "));
    await act(async () => result.current.confirm());

    expect(resumeMock).toHaveBeenCalledWith(
      "node_rates",
      expect.objectContaining({ reason: "Try again" }),
    );
    expect(result.current.open).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("names the safer path", () => {
    expect(renderedText(mount().result.current.saferPath).text).toBe("To keep it held, cancel.");
  });

  it.each([
    [
      "mission.node.state_conflict",
      "The state or the attempt of the node changed after this read.",
    ],
    ["mission.node.control_refused", "The node is no longer Paused."],
    ["mission.node.not_ready", "The node is not ready for its evaluation."],
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.node.retired", "The node is retired."],
    ["mission.node.terminal", "The node is terminal."],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    resumeMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("Try again"));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(toast.error).toHaveBeenCalledWith("Resuming Compute the rates failed.", {
      description: expect.stringContaining(message),
    });
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
