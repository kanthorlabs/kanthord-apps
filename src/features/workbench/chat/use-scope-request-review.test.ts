import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readMission, readMissionNode } from "@/api/resources/mission";
import { readProject } from "@/api/resources/projects";
import { approveScopeRequest, listInvites, rejectScopeRequest } from "@/api/resources/workbench";
import type { MissionNodeRecord, Project, ScopeRequest } from "@/api/types";
import { useScopeRequestReview } from "./use-scope-request-review";

vi.mock("@/api/resources/mission", () => ({ readMission: vi.fn(), readMissionNode: vi.fn() }));
vi.mock("@/api/resources/projects", () => ({ readProject: vi.fn() }));
vi.mock("@/api/resources/workbench", () => ({
  approveScopeRequest: vi.fn(),
  listInvites: vi.fn(),
  rejectScopeRequest: vi.fn(),
}));

const SESSION_ID = "workbench_session_1";
const PROJECT_NAME = "Secret Project";
const PROJECT = { id: "project_x", name: PROJECT_NAME, paused_at: null } as Project;
const NODE = {
  id: "node_1",
  state: "Blocked",
  attempt: 2,
  visible_revision: 4,
  content: { name: "Add retry" },
} as MissionNodeRecord;

const REQUEST: ScopeRequest = {
  id: "scope_request_1",
  invite_id: "invite_1",
  invitee_name: "Dana Lee",
  guest_name: "Dana",
  agent_name: "swe@1",
  operation_id: "mission.node.discard",
  description: "Discard a node.",
  input: { node_id: "node_1" },
  target_id: "node_1",
  ids: ["node_1"],
  project_id: "project_x",
  expected_keys: ["expected_mission_version", "expected_state", "expected_attempt"],
  created_at: Date.parse("2026-10-05T09:00:00.000Z"),
  expires_at: Date.parse("2026-10-12T09:00:00.000Z"),
  state: "open",
  error_code: null,
};

const readProjectMock = vi.mocked(readProject);
const readMissionMock = vi.mocked(readMission);
const readNodeMock = vi.mocked(readMissionNode);
const approveMock = vi.mocked(approveScopeRequest);
const rejectMock = vi.mocked(rejectScopeRequest);
const listInvitesMock = vi.mocked(listInvites);
const onDone = vi.fn();

function review(request: ScopeRequest = REQUEST) {
  return renderHook(() => useScopeRequestReview(SESSION_ID, request, onDone));
}

async function settled(request: ScopeRequest = REQUEST) {
  const view = review(request);
  await waitFor(() => expect(view.result.current.settled).toBe(true));
  return view;
}

beforeEach(() => {
  vi.resetAllMocks();
  readProjectMock.mockResolvedValue(PROJECT);
  readMissionMock.mockResolvedValue({ id: "mission_1", project_id: "project_x", version: 7 });
  readNodeMock.mockResolvedValue(NODE);
  listInvitesMock.mockResolvedValue({
    items: [],
    grantable: [],
    project_ids: ["project_a", "project_b"],
  });
});

describe("useScopeRequestReview", () => {
  it("reads the project, the mission, the node and the invites at open", async () => {
    const { result } = await settled();

    expect(readProjectMock).toHaveBeenCalledWith("project_x");
    expect(readMissionMock).toHaveBeenCalledWith("project_x");
    expect(readNodeMock).toHaveBeenCalledWith("node_1");
    expect(listInvitesMock).toHaveBeenCalledWith(SESSION_ID);
    expect(result.current.confirmName).toBe(PROJECT_NAME);
    expect(result.current.sharedNames).toEqual(["project_a", "project_b"]);
    expect(result.current.facts).toEqual(["Node Add retry · Blocked · attempt 2"]);
  });

  it("classifies each id by its prefix and shows the facts of the node and the project", async () => {
    const { result } = await settled({ ...REQUEST, ids: ["node_1", "project_x"] });

    expect(readNodeMock).toHaveBeenCalledWith("node_1");
    expect(result.current.facts).toEqual([
      "Node Add retry · Blocked · attempt 2",
      "Project Secret Project · running",
    ]);
  });

  it.each([
    ["an empty name", ""],
    ["a case-changed name", "secret project"],
    ["a space-padded name", ` ${PROJECT_NAME} `],
    ["a partial name", "Secret"],
  ])("does not match %s", async (_label, typed) => {
    const { result } = await settled();

    act(() => result.current.setTyped(typed));

    expect(result.current.matches).toBe(false);
    expect(result.current.canApprove).toBe(false);
  });

  it("matches the exact name and allows approval", async () => {
    const { result } = await settled();

    act(() => result.current.setTyped(PROJECT_NAME));

    expect(result.current.matches).toBe(true);
    expect(result.current.canApprove).toBe(true);
  });

  it("keeps approval off while a read loads", async () => {
    let finish: (node: MissionNodeRecord) => void = () => undefined;
    readNodeMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = review();
    await waitFor(() => expect(result.current.confirmName).toBe(PROJECT_NAME));

    act(() => result.current.setTyped(PROJECT_NAME));
    expect(result.current.settled).toBe(false);
    expect(result.current.canApprove).toBe(false);

    await act(async () => finish(NODE));
    await waitFor(() => expect(result.current.canApprove).toBe(true));
  });

  it("keeps approval off after a failed read and shows the failure", async () => {
    readNodeMock.mockRejectedValue(new ApiError("not_found", "The node does not exist.", 404));
    const { result } = await settled();

    act(() => result.current.setTyped(PROJECT_NAME));

    expect(result.current.readFailure).toBe("The node does not exist.");
    expect(result.current.canApprove).toBe(false);
  });

  it("keeps approval off for a request that is not open", async () => {
    const { result } = await settled({ ...REQUEST, state: "running" });

    act(() => result.current.setTyped(PROJECT_NAME));

    expect(result.current.canApprove).toBe(false);
  });

  it("marks a key outside the map as unavailable with the reason", async () => {
    const { result } = await settled({ ...REQUEST, expected_keys: ["expected_unknown"] });

    act(() => result.current.setTyped(PROJECT_NAME));

    expect(result.current.available).toBe(false);
    expect(result.current.unavailableReason).toBe(
      "This request cannot be approved from this dashboard version.",
    );
    expect(result.current.canApprove).toBe(false);
  });

  it("sends the typed name and the expected values of the reads", async () => {
    approveMock.mockResolvedValue({ request_id: REQUEST.id, outcome: "done", error_code: null });
    const { result } = await settled();
    act(() => result.current.setTyped(PROJECT_NAME));

    await act(() => result.current.approve());

    expect(approveMock).toHaveBeenCalledWith(SESSION_ID, REQUEST.id, {
      project_name: PROJECT_NAME,
      expected: { expected_mission_version: 7, expected_state: "Blocked", expected_attempt: 2 },
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("sends blocked_attempt for an unblock request", async () => {
    approveMock.mockResolvedValue({ request_id: REQUEST.id, outcome: "done", error_code: null });
    const { result } = await settled({
      ...REQUEST,
      operation_id: "mission.node.unblock",
      expected_keys: ["blocked_attempt", "expected_revision", "expected_mission_version"],
    });
    act(() => result.current.setTyped(PROJECT_NAME));

    await act(() => result.current.approve());

    expect(approveMock).toHaveBeenCalledWith(SESSION_ID, REQUEST.id, {
      project_name: PROJECT_NAME,
      expected: { blocked_attempt: 2, expected_revision: 4, expected_mission_version: 7 },
    });
  });

  it("approves a project request with no node read", async () => {
    approveMock.mockResolvedValue({ request_id: REQUEST.id, outcome: "done", error_code: null });
    const { result } = await settled({
      ...REQUEST,
      operation_id: "project.pause",
      target_id: "project_x",
      ids: ["project_x"],
      expected_keys: [],
    });

    expect(readNodeMock).not.toHaveBeenCalled();
    expect(readMissionMock).not.toHaveBeenCalled();
    expect(result.current.facts).toEqual(["Project Secret Project · running"]);
    act(() => result.current.setTyped(PROJECT_NAME));
    expect(result.current.canApprove).toBe(true);

    await act(() => result.current.approve());

    expect(approveMock).toHaveBeenCalledWith(SESSION_ID, REQUEST.id, {
      project_name: PROJECT_NAME,
      expected: {},
    });
  });

  it("approves a project request on a project with no mission", async () => {
    readMissionMock.mockRejectedValue(new Error("no mission"));
    const { result } = await settled({
      ...REQUEST,
      operation_id: "project.pause",
      target_id: "project_x",
      ids: ["project_x"],
      expected_keys: [],
    });

    act(() => result.current.setTyped(PROJECT_NAME));

    expect(result.current.readFailure).toBeNull();
    expect(result.current.canApprove).toBe(true);
  });

  it("shows the code first for a 409 refusal and keeps the dialog open", async () => {
    approveMock.mockRejectedValue(
      new ApiError("refused", "The act was refused.", 409, "workbench.scope_request.refused"),
    );
    const { result } = await settled();
    act(() => result.current.setTyped(PROJECT_NAME));

    await act(() => result.current.approve());

    expect(result.current.failure).toEqual({
      code: "workbench.scope_request.refused",
      message: "The act was refused.",
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("reads the project again after a name mismatch", async () => {
    approveMock.mockRejectedValue(
      new ApiError("conflict", "Mismatch.", 409, "workbench.scope_request.name_mismatch"),
    );
    const { result } = await settled();
    act(() => result.current.setTyped(PROJECT_NAME));

    await act(() => result.current.approve());

    expect(result.current.failure?.code).toBe("workbench.scope_request.name_mismatch");
    await waitFor(() => expect(readProjectMock).toHaveBeenCalledTimes(2));
  });

  it("shows the error code of a failed outcome", async () => {
    approveMock.mockResolvedValue({
      request_id: REQUEST.id,
      outcome: "failed",
      error_code: "mission.node.stale",
    });
    const { result } = await settled();
    act(() => result.current.setTyped(PROJECT_NAME));

    await act(() => result.current.approve());

    expect(result.current.failure?.code).toBe("mission.node.stale");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("rejects through the reject resource", async () => {
    rejectMock.mockResolvedValue({ request_id: REQUEST.id });
    const { result } = await settled();

    await act(() => result.current.reject());

    expect(rejectMock).toHaveBeenCalledWith(SESSION_ID, REQUEST.id);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("states the consequence and the safer path", async () => {
    const { result } = await settled();

    expect(result.current.consequence?.map((part) => part.text).join("")).toBe(
      "This runs mission.node.discard on node_1 in project Secret Project. Secret Project is not shared in this conversation. Dana (guest) cannot see it. The act runs as your own act. Nothing about it enters this conversation. Anything that you or your own runs write here reaches every guest.",
    );
    expect(
      result.current.consequence?.filter((part) => part.bold).map((part) => part.text),
    ).toEqual([PROJECT_NAME, PROJECT_NAME]);
    expect(result.current.saferPath).toBe(
      "Reject keeps the project hidden. To share the project, revoke the invites and share a new conversation.",
    );
    expect(result.current.requestedLine).toBe(
      "Requested in a run started by Dana (guest) · invite for Dana Lee",
    );
  });
});
