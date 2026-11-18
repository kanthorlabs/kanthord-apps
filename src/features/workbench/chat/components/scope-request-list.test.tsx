import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readMission, readMissionNode } from "@/api/resources/mission";
import { readProject } from "@/api/resources/projects";
import { listInvites } from "@/api/resources/workbench";
import type { MissionNodeRecord, Project, ScopeRequest } from "@/api/types";
import { SCOPE_REQUEST_HELPER } from "@/lib/scope-request";
import { ScopeRequestList } from "./scope-request-list";

vi.mock("@/api/resources/mission", () => ({ readMission: vi.fn(), readMissionNode: vi.fn() }));
vi.mock("@/api/resources/projects", () => ({ readProject: vi.fn() }));
vi.mock("@/api/resources/workbench", () => ({
  approveScopeRequest: vi.fn(),
  listInvites: vi.fn(),
  rejectScopeRequest: vi.fn(),
}));

const NOW = Date.parse("2026-10-05T09:03:30.000Z");
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
  ids: { node_id: "node_1" },
  project_id: "project_x",
  expected_keys: ["expected_mission_version"],
  created_at: Date.parse("2026-10-05T09:00:00.000Z"),
  expires_at: Date.parse("2026-10-12T09:00:00.000Z"),
  state: "open",
  error_code: null,
};
const onResolved = vi.fn();

function renderList(requests: readonly ScopeRequest[]) {
  return render(
    <ScopeRequestList
      sessionId="workbench_session_1"
      requests={requests}
      onResolved={onResolved}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  vi.resetAllMocks();
  vi.mocked(readProject).mockResolvedValue({
    id: "project_x",
    name: "Secret",
    paused_at: null,
  } as Project);
  vi.mocked(readMission).mockResolvedValue({
    id: "mission_1",
    project_id: "project_x",
    version: 7,
  });
  vi.mocked(readMissionNode).mockResolvedValue({
    id: "node_1",
    state: "Blocked",
    attempt: 1,
    visible_revision: 1,
    content: { name: "Add retry" },
  } as MissionNodeRecord);
  vi.mocked(listInvites).mockResolvedValue({
    items: [],
    grantable: [],
    project_ids: ["project_a"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ScopeRequestList", () => {
  it("renders nothing for no request", () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a request that is not open", () => {
    const { container } = renderList([{ ...REQUEST, state: "running" }]);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the heading, the helper line and one row per open request", () => {
    renderList([REQUEST, { ...REQUEST, id: "scope_request_2", operation_id: "project.pause" }]);

    expect(
      screen.getByRole("heading", { name: "Requests outside the shared projects" }),
    ).toBeVisible();
    expect(screen.getByText(SCOPE_REQUEST_HELPER)).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the guest, the operation, the target, the age and the expiry date in a row", () => {
    renderList([REQUEST]);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Requested in a run started by Dana (guest)");
    expect(row).toHaveTextContent("mission.node.discard");
    expect(row).toHaveTextContent("node_1");
    expect(row).toHaveTextContent("Requested 3 min ago · ends with the invite on 2026-10-12");
  });

  it("holds only the Review button in a row", () => {
    renderList([REQUEST]);

    const buttons = within(screen.getByRole("listitem")).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Review"]);
  });

  it("opens the dialog on Review and closes it on Cancel", async () => {
    vi.useRealTimers();
    renderList([REQUEST]);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Run an act outside the shared projects",
    });
    await waitFor(() => expect(readProject).toHaveBeenCalledWith("project_x"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
