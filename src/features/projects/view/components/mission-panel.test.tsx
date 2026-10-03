import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type { MissionImportPreview, MissionJsonExport } from "@/api/types";

vi.mock("@/api/resources/mission");

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

function planFile(): File {
  return new File([JSON.stringify({ entries: [CURRENT.entries[0]] })], "plan.json", {
    type: "application/json",
  });
}

async function previewImport() {
  render(<MissionPanel projectId="project_1" projectName="kanthord" />);
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
  });

  it("shows the mission version and the graph placeholder", async () => {
    render(<MissionPanel projectId="project_1" projectName="kanthord" />);

    expect(await screen.findByText("version 3")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Mission graph" })).toHaveTextContent(
      "The graph view comes next.",
    );
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
    expect(await screen.findByText("The mission is now at version 4.")).toBeTruthy();
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
