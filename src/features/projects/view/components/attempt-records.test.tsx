import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { downloadEvidenceAsset } from "@/api/resources/mission";
import type { MissionAttempt, MissionEvidence, MissionEvidenceAsset } from "@/api/types";
import type { GraphModel } from "@/lib/mission-graph";
import { useAttemptRecords } from "../use-attempt-records";
import { AttemptRecords } from "./attempt-records";

vi.mock("@/api/resources/mission", () => ({ downloadEvidenceAsset: vi.fn() }));
vi.mock("../use-attempt-records", () => ({ useAttemptRecords: vi.fn() }));
vi.mock("../use-trace-summaries", () => ({ useTraceSummaries: () => new Map() }));

const ATTEMPT: MissionAttempt = {
  node_id: "node_1",
  attempt: 1,
  node_revision: 1,
  start_point: "base_branch",
  required_external_actions: [],
  opened_at: 0,
  closed_at: null,
  outcome_ids: [],
  opened_by: { kind: "service", service: "mission" },
};

const MODEL = { nodes: [], edges: [] } as unknown as GraphModel;

const PRODUCED: MissionEvidenceAsset = {
  id: "asset_produced",
  kind: "produced",
  address: { kind: "produced", sha256: "a".repeat(64) },
  published_at: 1,
  expired_at: null,
};

function objectAsset(id: string, size: number, publishedAt: number | null): MissionEvidenceAsset {
  return {
    id,
    kind: "object",
    address: { kind: "object", location: `s3://bucket/${id}` },
    storage_binding_id: "binding_1",
    size,
    media_type: "text/plain",
    published_at: publishedAt,
    expired_at: null,
  };
}

const REPOSITORY: MissionEvidenceAsset = {
  id: "asset_repository",
  kind: "repository",
  address: { kind: "repository", binding_id: "binding_1", commit: "c".repeat(40) },
  published_at: 1,
  expired_at: null,
};

const PLATFORM: MissionEvidenceAsset = {
  id: "asset_platform",
  kind: "platform",
  address: { kind: "pull_request", resource_identity: "repository:github:a/b", number: 4 },
  published_at: 1,
  expired_at: null,
};

function evidenceOf(assets: readonly MissionEvidenceAsset[]): MissionEvidence {
  return {
    id: "evidence_1",
    node_id: "node_1",
    attempt: 1,
    subject: "Evidence subject",
    assets,
    provenance: { kind: "service", service: "mission" },
    created_at: 0,
  };
}

function renderRecords(assets: readonly MissionEvidenceAsset[]) {
  const empty = { data: [], error: null };
  const failed = {
    data: null,
    error: new ApiError("not_found", "No such record.", 404),
  };
  vi.mocked(useAttemptRecords).mockReturnValue({
    data: {
      revision: failed,
      executions: empty,
      evidence: { data: [evidenceOf(assets)], error: null },
      assessments: empty,
      outcomes: empty,
      externalActions: empty,
      findings: empty,
      bindings: new Map(),
    },
    error: null,
    loading: false,
    reload: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <AttemptRecords
        projectId="project_1"
        model={MODEL}
        attempt={ATTEMPT}
        currentRevision={1}
        refreshKey={0}
        onEditFinding={vi.fn()}
      />
    </MemoryRouter>,
  );
}

const MAX = 536870912;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AttemptRecords evidence assets", () => {
  it("shows Download for a produced asset and a published object asset", () => {
    renderRecords([PRODUCED, objectAsset("asset_object", MAX, 1)]);

    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(2);
  });

  it("shows the size of an object asset with byteText", () => {
    renderRecords([objectAsset("asset_size", 18637, 1)]);

    expect(screen.getByText("18.2 KiB")).toBeInTheDocument();
  });

  it("shows the CLI line with the asset id and no button for an object above 512 MiB", () => {
    renderRecords([objectAsset("asset_big", MAX + 1, 1)]);

    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(
      screen.getByText("kanthord mission evidence asset content get asset_big"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Too large for the dashboard\. Use/)).toBeInTheDocument();
  });

  it("shows no button for a repository, a platform and an unpublished object asset", () => {
    renderRecords([REPOSITORY, PLATFORM, objectAsset("asset_draft", 10, null)]);

    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(screen.queryByText(/Too large for the dashboard/)).toBeNull();
  });

  it("shows the error line directly under the failed asset row", async () => {
    vi.mocked(downloadEvidenceAsset).mockRejectedValue(
      new ApiError(
        "malformed",
        "The storage read failed.",
        502,
        "mission.evidence.content_unavailable",
      ),
    );
    renderRecords([PRODUCED, REPOSITORY]);

    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    const region = screen.getByRole("region", { name: "Evidence" });
    const line = await within(region).findByRole("alert");
    expect(line).toHaveTextContent("mission.evidence.content_unavailable The storage read failed.");
    expect(downloadEvidenceAsset).toHaveBeenCalledWith("asset_produced");
    const row = line.parentElement as HTMLElement;
    expect(within(row).getByRole("button", { name: "Download" })).toBeInTheDocument();
    expect(line.previousElementSibling).toHaveClass("border-destructive");
    expect(within(region).getAllByRole("alert")).toHaveLength(1);
  });

  it("shows the message alone when the error holds no code", async () => {
    vi.mocked(downloadEvidenceAsset).mockRejectedValue(
      new ApiError("unreachable", "No server is connected.", 0),
    );
    renderRecords([PRODUCED]);

    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    const region = screen.getByRole("region", { name: "Evidence" });
    const line = await within(region).findByRole("alert");
    expect(line.textContent).toBe("No server is connected.");
  });
});
