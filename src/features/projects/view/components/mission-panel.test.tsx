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
  MissionTaskContent,
  Intent,
} from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { MissionPanel } from "./mission-panel";
import { textContent } from "../../../../../test/text-content";

const MISSION = { id: "mission_1", project_id: "project_1", version: 3 };

const CURRENT: MissionJsonExport = {
  mission_id: "mission_1",
  mission_version: 3,
  entries: [
    {
      filename: "onboarding.md",
      id: "node_1",
      intent: "examine",
      name: "Onboarding",
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
    },
    {
      filename: "reset-expiry.md",
      id: "node_2",
      intent: "implement",
      name: "Add reset token expiry",
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
      tags: [],
      depends_on: [],
    },
  ],
};

const PREVIEW: MissionImportPreview = {
  mission_id: "mission_1",
  expected_mission_version: 3,
  preview_digest: "d".repeat(64),
  creates: ["new-task.md"],
  updates: ["node_1"],
  retirements: ["node_2"],
  removed_edges: [],
  no_ops: [],
  violations: [],
};

function task(id: string, name: string): MissionTaskContent {
  return {
    id,
    filename: `${id}.md`,
    content: { name, requirement: "r", criterion: "c", verifications: ["v"], bindings: [] },
  };
}

function node(
  id: string,
  intent: Intent,
  name: string,
  state: MissionNodeRecord["state"],
  tasks: readonly MissionTaskContent[] = [],
): MissionNodeRecord {
  return {
    id,
    intent,
    tags: [],
    tasks,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name,
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
      intent,
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state,
    attempt: 0,
    priority: 0,
    depends_on: [],
  };
}

const GRAPH: readonly MissionNodeRecord[] = [
  node("node_1", "examine", "Onboarding", "Pending"),
  node("node_3", "implement", "Add recovery codes", "Completed"),
  node("node_4", "implement", "Add password reset", "Pending", [
    task("task_1", "Add reset token expiry"),
    task("task_2", "Send the reset email"),
    task("task_3", "Rate-limit the reset form"),
  ]),
  node("node_2", "implement", "Add reset token expiry", "Pending"),
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
      { dependent_id: "node_4", depends_on_id: "node_3" },
      { dependent_id: "node_1", depends_on_id: "node_4" },
    ]);
  });

  it("shows every node of the mission as a rectangle with its intent and state", async () => {
    renderPanel();

    expect(await screen.findByText("version 3")).toBeTruthy();
    const graph = await screen.findByRole("list", { name: "Nodes" });
    expect(within(graph).getByRole("button", { name: "Onboarding" })).toBeTruthy();
    expect(within(graph).getByText("Completed")).toBeTruthy();
    expect(within(graph).getAllByText("examine")).toHaveLength(1);
    expect(within(graph).getAllByText("implement")).toHaveLength(3);
    expect(within(graph).getByText(textContent("Depends on: Add recovery codes"))).toBeTruthy();
  });

  it("an implement node card shows Tasks (3)", async () => {
    renderPanel();

    const graph = await screen.findByRole("list", { name: "Nodes" });
    const tasks = within(graph).getByRole("list", { name: "Tasks of Add password reset" });
    expect(tasks.previousElementSibling).toHaveTextContent("Tasks (3)");
    expect(within(tasks).getAllByRole("button")).toHaveLength(3);
  });

  it("opens the node sheet of its node from a task row", async () => {
    renderPanel();

    const graph = await screen.findByRole("list", { name: "Nodes" });
    const tasks = within(graph).getByRole("list", { name: "Tasks of Add password reset" });
    await userEvent.click(within(tasks).getByRole("button", { name: "Send the reset email" }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("implement · node_4.md")).toBeTruthy();
  });

  it("an examine node card shows no Tasks section", async () => {
    renderPanel();

    const graph = await screen.findByRole("list", { name: "Nodes" });
    expect(within(graph).queryByRole("list", { name: "Tasks of Onboarding" })).toBeNull();
    expect(within(graph).queryByRole("list", { name: "Tasks of Add recovery codes" })).toBeNull();
    expect(within(graph).getAllByText(/^Tasks/)).toHaveLength(1);
  });

  it("marks the selected node and opens its details", async () => {
    renderPanel();

    const node = await screen.findByRole("button", { name: "Add recovery codes" });
    await userEvent.click(node);

    expect(node).toHaveAttribute("aria-current", "true");
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("implement · node_3.md")).toBeTruthy();
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
      { dependent_id: "node_4", depends_on_id: "node_9" },
    ]);
    renderPanel();

    expect(await screen.findByText("The graph can be incomplete.")).toBeTruthy();
    expect(missionApi.listMissionNodes).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText(
        textContent(
          "A dependency of Add password reset names node_9, and the read does not hold that node.",
        ),
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

  it("downloads the Markdown export as one zip archive", async () => {
    vi.mocked(missionApi.exportMissionMarkdown).mockResolvedValue({
      mission_id: "mission_1",
      mission_version: 3,
      files: [{ filename: "onboarding.md", content: "# Onboarding\n" }],
    });
    const createObjectURL = vi.fn(() => "blob:plan");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Export Markdown" }));

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(missionApi.exportMissionMarkdown).toHaveBeenCalledWith("mission_1");
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("kanthord-mission-v3.zip");
    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: "application/zip" }),
    );
    click.mockRestore();
  });

  it("previews with the current mission version and names the retired nodes", async () => {
    await previewImport();

    const retirements = await screen.findByRole("list", { name: "Retirements" });
    expect(within(retirements).getByText("Add reset token expiry")).toBeTruthy();
    expect(missionApi.previewMissionImport).toHaveBeenCalledWith({
      format: "json",
      mission_id: "mission_1",
      mission_version: 3,
      reason: "Drop the expiry task",
      entries: [CURRENT.entries[0]],
    });
  });

  it("applies only after the human confirms the whole retirement set", async () => {
    vi.mocked(missionApi.applyMissionImport).mockResolvedValue({
      mission_id: "mission_1",
      mission_version: 4,
      assigned_ids: [],
    });
    await previewImport();

    const apply = await screen.findByRole("button", { name: "Apply and retire 1 node" });
    expect(apply).toBeDisabled();
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(apply);

    expect(missionApi.applyMissionImport).toHaveBeenCalledWith(
      expect.objectContaining({
        preview_digest: PREVIEW.preview_digest,
        confirmed_retirements: ["node_2"],
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("The import is applied.", {
        description: "The mission is now at version 4. 1 new node received an identity.",
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
      mission_id: "mission_1",
      mission_version: 4,
      assigned_ids: [
        { filename: "reset-email.md", node_id: "node_1" },
        { filename: "expiry.md", node_id: "node_2" },
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

  it("names the node count of the toast and the apply button in the plural", async () => {
    vi.mocked(missionApi.previewMissionImport).mockResolvedValue({
      ...PREVIEW,
      creates: ["a.md", "b.md"],
      retirements: ["node_2", "node_3"],
    });
    vi.mocked(missionApi.applyMissionImport).mockResolvedValue({
      mission_id: "mission_1",
      mission_version: 4,
      assigned_ids: [],
    });
    await previewImport();

    const apply = await screen.findByRole("button", { name: "Apply and retire 2 nodes" });
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(apply);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("The import is applied.", {
        description: "The mission is now at version 4. 2 new nodes received an identity.",
      }),
    );
  });

  it("words the summary line and the retire label for one and for two nodes", async () => {
    vi.mocked(missionApi.previewMissionImport).mockResolvedValue({
      ...PREVIEW,
      no_ops: ["node_5"],
      removed_edges: [
        { dependent_id: "node_1", depends_on_id: "node_3" },
        { dependent_id: "node_1", depends_on_id: "node_4" },
      ],
    });
    await previewImport();

    expect(await screen.findByText("1 node stays unchanged. 2 edges are removed.")).toBeTruthy();
    expect(screen.getByText(/^Retire the 1 node listed above\./)).toBeTruthy();
  });

  it("words the retire label for two nodes", async () => {
    vi.mocked(missionApi.previewMissionImport).mockResolvedValue({
      ...PREVIEW,
      no_ops: ["node_5", "node_6"],
      removed_edges: [{ dependent_id: "node_1", depends_on_id: "node_3" }],
      retirements: ["node_2", "node_3"],
    });
    await previewImport();

    expect(await screen.findByText("2 nodes stay unchanged. 1 edge is removed.")).toBeTruthy();
    expect(screen.getByText(/^Retire the 2 nodes listed above\./)).toBeTruthy();
  });

  it("returns to review when the mission changed after the preview", async () => {
    vi.mocked(missionApi.applyMissionImport).mockRejectedValue(
      new ApiError("conflict", "The expected mission version differs.", 409),
    );
    await previewImport();

    await userEvent.click(await screen.findByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Apply and retire 1 node" }));

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
          node_id: null,
          details: null,
        },
      ],
    });
    await previewImport();

    expect(await screen.findByText("plan.md: A plan file breaks the import grammar.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply import" })).toBeDisabled();
  });
});
