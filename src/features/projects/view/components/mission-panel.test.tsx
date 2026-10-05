import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type {
  MissionImportPreview,
  MissionJsonExport,
  MissionNodeRecord,
  MissionRunnableNode,
} from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { MissionPanel } from "./mission-panel";

const MISSION = { id: "mission_1", projectId: "project_1", version: 3 };

const CURRENT: MissionJsonExport = {
  missionId: "mission_1",
  missionVersion: 3,
  entries: [
    {
      filename: "onboarding.md",
      id: "node_1",
      kind: "initiative",
      name: "Onboarding",
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
    },
    {
      filename: "reset-expiry.md",
      id: "node_2",
      kind: "task",
      name: "Add reset token expiry",
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
      parent: "onboarding.md",
    },
  ],
};

const PREVIEW: MissionImportPreview = {
  missionId: "mission_1",
  expectedMissionVersion: 3,
  previewDigest: "d".repeat(64),
  creates: ["new-task.md"],
  updates: ["node_1"],
  retirements: ["node_2"],
  removedEdges: [],
  noOps: [],
  violations: [],
};

function runnable(
  id: string,
  kind: "initiative" | "objective",
  name: string,
  parentId: string | null,
  state: MissionRunnableNode["state"],
): MissionRunnableNode {
  return {
    id,
    kind,
    filename: `${id}.md`,
    missionId: "mission_1",
    parentId,
    visibleRevision: 1,
    content: { name, requirement: "r", criterion: "c", verifications: ["v"], bindings: [] },
    retiredAt: null,
    pinnedByAttempts: [],
    state,
    attempt: 0,
    priority: 0,
    dependsOn: [],
  };
}

const GRAPH: readonly MissionNodeRecord[] = [
  runnable("node_1", "initiative", "Onboarding", null, "Available"),
  runnable("node_3", "objective", "Add recovery codes", "node_1", "Completed"),
  runnable("node_4", "objective", "Add password reset", "node_1", "Pending"),
  {
    id: "node_2",
    kind: "task",
    filename: "reset-expiry.md",
    missionId: "mission_1",
    parentId: "node_4",
    visibleRevision: 1,
    content: {
      name: "Add reset token expiry",
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
    },
    retiredAt: null,
    pinnedByAttempts: [],
  },
];

function renderPanel() {
  return render(
    <MemoryRouter>
      <MissionPanel projectId="project_1" projectName="kanthord" />
    </MemoryRouter>,
  );
}

function planFile(): File {
  return new File([JSON.stringify({ entries: [CURRENT.entries[0]] })], "plan.json", {
    type: "application/json",
  });
}

async function previewImport() {
  renderPanel();
  await userEvent.click(await screen.findByRole("button", { name: "Import" }));
  await userEvent.upload(screen.getByLabelText("Plan files"), planFile());
  await userEvent.type(screen.getByLabelText("Reason"), "Drop the expiry task");
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
}

describe("MissionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.readMission).mockResolvedValue(MISSION);
    vi.mocked(missionApi.exportMissionJson).mockResolvedValue(CURRENT);
    vi.mocked(missionApi.previewMissionImport).mockResolvedValue(PREVIEW);
    vi.mocked(missionApi.listMissionNodes).mockResolvedValue(GRAPH);
    vi.mocked(missionApi.readMissionNode).mockImplementation(async (nodeId) => {
      const node = GRAPH.find((item) => item.id === nodeId);
      if (node === undefined) throw new ApiError("not_found", "No such node.", 404);
      return node;
    });
    vi.mocked(missionApi.listMissionDependencies).mockResolvedValue([
      { kind: "dependency", dependentId: "node_4", dependsOnId: "node_3" },
    ]);
  });

  it("shows every node of the mission as a rectangle with its state", async () => {
    renderPanel();

    expect(await screen.findByText("version 3")).toBeTruthy();
    const graph = await screen.findByRole("list", { name: "Initiatives" });
    expect(within(graph).getByRole("button", { name: "Onboarding" })).toBeTruthy();
    const objectives = within(graph).getByRole("list", { name: "Objectives of Onboarding" });
    expect(within(objectives).getByText("Completed")).toBeTruthy();
    expect(within(objectives).getByText("Depends on: Add recovery codes")).toBeTruthy();
    const tasks = within(graph).getByRole("list", { name: "Tasks of Add password reset" });
    expect(within(tasks).getByRole("button", { name: "Add reset token expiry" })).toBeTruthy();
  });

  it("states the progress of the objectives of an initiative", async () => {
    renderPanel();

    expect(await screen.findByText("Objectives: 1 of 2 terminal")).toBeTruthy();
  });

  it("marks the selected node and opens its details", async () => {
    renderPanel();

    const node = await screen.findByRole("button", { name: "Add recovery codes" });
    await userEvent.click(node);

    expect(node).toHaveAttribute("aria-current", "true");
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("objective · node_3.md")).toBeTruthy();
    expect(await within(sheet).findByText("Content of revision 1")).toBeTruthy();
  });

  it("says that the mission holds no nodes", async () => {
    vi.mocked(missionApi.listMissionNodes).mockResolvedValue([]);
    vi.mocked(missionApi.listMissionDependencies).mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText("The mission holds no nodes.")).toBeTruthy();
  });

  it("warns when a dependency names a node that the read does not hold", async () => {
    vi.mocked(missionApi.listMissionDependencies).mockResolvedValue([
      { kind: "dependency", dependentId: "node_4", dependsOnId: "node_9" },
    ]);
    renderPanel();

    expect(await screen.findByText("The graph can be incomplete.")).toBeTruthy();
    expect(missionApi.listMissionNodes).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText(
        "A dependency of Add password reset names node_9, and the read does not hold that node.",
      ),
    ).toBeTruthy();
  });

  it("reads the graph again when the mission version moves during the read", async () => {
    vi.mocked(missionApi.readMission)
      .mockResolvedValueOnce(MISSION)
      .mockResolvedValueOnce(MISSION)
      .mockResolvedValue({ ...MISSION, version: 4 });
    renderPanel();

    expect(await screen.findByRole("button", { name: "Onboarding" })).toBeTruthy();
    expect(missionApi.listMissionNodes).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("The graph can be incomplete.")).toBeNull();
  });

  it("offers a retry when the graph read fails", async () => {
    vi.mocked(missionApi.listMissionNodes).mockRejectedValue(
      new ApiError("unavailable", "The daemon is unavailable.", 503),
    );
    renderPanel();

    expect(await screen.findByText("The daemon is unavailable.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("previews with the current mission version and names the retired nodes", async () => {
    await previewImport();

    const retirements = await screen.findByRole("list", { name: "Retirements" });
    expect(within(retirements).getByText("Add reset token expiry")).toBeTruthy();
    expect(missionApi.previewMissionImport).toHaveBeenCalledWith({
      format: "json",
      missionId: "mission_1",
      missionVersion: 3,
      reason: "Drop the expiry task",
      entries: [CURRENT.entries[0]],
    });
  });

  it("applies only after the human confirms the whole retirement set", async () => {
    vi.mocked(missionApi.applyMissionImport).mockResolvedValue({
      missionId: "mission_1",
      missionVersion: 4,
      assignedIds: [],
    });
    await previewImport();

    const apply = await screen.findByRole("button", { name: "Apply and retire 1 nodes" });
    expect(apply).toBeDisabled();
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(apply);

    expect(missionApi.applyMissionImport).toHaveBeenCalledWith(
      expect.objectContaining({
        previewDigest: PREVIEW.previewDigest,
        confirmedRetirements: ["node_2"],
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("The import is applied.", {
        description: "The mission is now at version 4. 1 new nodes received an identity.",
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Import mission" })).toBeNull();
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
  });

  it("names no new node when the applied import creates none", async () => {
    vi.mocked(missionApi.previewMissionImport).mockResolvedValue({
      ...PREVIEW,
      creates: [],
      retirements: [],
    });
    vi.mocked(missionApi.applyMissionImport).mockResolvedValue({
      missionId: "mission_1",
      missionVersion: 4,
      assignedIds: [
        { filename: "reset-email.md", nodeId: "node_1" },
        { filename: "expiry.md", nodeId: "node_2" },
      ],
    });
    await previewImport();

    await userEvent.click(await screen.findByRole("button", { name: "Apply import" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("The import is applied.", {
        description: "The mission is now at version 4.",
      }),
    );
  });

  it("returns to review when the mission changed after the preview", async () => {
    vi.mocked(missionApi.applyMissionImport).mockRejectedValue(
      new ApiError("conflict", "The expected mission version differs.", 409),
    );
    await previewImport();

    await userEvent.click(await screen.findByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Apply and retire 1 nodes" }));

    expect(await screen.findByText("Preview again")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Retirements" })).toBeNull();
    expect(missionApi.applyMissionImport).toHaveBeenCalledOnce();
  });

  it("blocks the apply when the preview holds a violation", async () => {
    vi.mocked(missionApi.previewMissionImport).mockResolvedValue({
      ...PREVIEW,
      retirements: [],
      violations: [
        {
          code: "mission.import.plan_invalid",
          message: "A plan file breaks the import grammar.",
          filename: "plan.md",
          nodeId: null,
          details: null,
        },
      ],
    });
    await previewImport();

    expect(await screen.findByText("plan.md: A plan file breaks the import grammar.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply import" })).toBeDisabled();
  });
});
