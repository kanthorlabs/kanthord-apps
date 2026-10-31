import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listNodeEvidence } from "@/api/resources/mission";
import { listTracePage } from "@/api/resources/tracking";
import type { MissionEvidence, MissionNodeRecord, Project } from "@/api/types";
import type { BlockedItem } from "@/lib/attention";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/tracking");

import { BoardActsProvider } from "./board-acts";
import { BoardDetail } from "./board-detail";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const TEAM: MissionNodeRecord = {
  id: "node_1",
  intent: "implement",
  tags: [],
  tasks: [],
  filename: "node_1.md",
  mission_id: "mission_1",
  visible_revision: 1,
  content: {
    name: "Team",
    requirement: "r",
    criterion: "c",
    verifications: [],
    bindings: [],
    intent: "implement",
    tags: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  pinned_revision: null,
  state: "Blocked",
  attempt: 2,
  priority: 0,
  depends_on: [],
};

const ITEM: BlockedItem = {
  id: "blocked:node_1",
  kind: "blocked",
  group: "decisions",
  project: PROJECT,
  subject: "Team",
  missionVersion: 7,
  node: TEAM,
  nodes: [TEAM],
  at: null,
  cause: "Criterion not met",
};

function renderDetail(widthClass: BoardWidth) {
  render(
    <MemoryRouter>
      <BoardActsProvider
        item={ITEM}
        details={new Map()}
        reload={vi.fn()}
        retryDetail={vi.fn()}
        markActed={vi.fn()}
        setDialogOpen={vi.fn()}
        registerDialogCloser={vi.fn()}
        widthClass={widthClass}
      >
        <BoardDetail
          item={ITEM}
          widthClass={widthClass}
          position={{ index: 0, total: 2 }}
          environments={null}
          details={new Map()}
          now={10_000_000}
          tabName="Rule"
          held={[]}
          titleId="detail-title"
          titleRef={() => undefined}
        />
      </BoardActsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listNodeEvidence).mockResolvedValue([
    { id: "ev1", subject: "Add the team", assets: [] } as unknown as MissionEvidence,
  ]);
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
});

describe.each([BOARD_WIDTH.Expanded, BOARD_WIDTH.Medium, BOARD_WIDTH.Compact])(
  "BoardDetail on %s width",
  (widthClass) => {
    it("is a region named by the title with the sections and the act bar", () => {
      renderDetail(widthClass);

      const region = screen.getByRole("region", { name: "Team: criterion not met" });

      expect(within(region).getAllByRole("heading", { level: 4 })).toHaveLength(6);
      expect(within(region).getByRole("group", { name: "Acts" })).toBeVisible();
    });

    it("mounts the reads of the selected item around the sections", async () => {
      renderDetail(widthClass);

      expect(await screen.findByText("Add the team")).toBeVisible();
      expect(listNodeEvidence).toHaveBeenCalledWith("node_1", 2);
      expect(listNodeEvidence).toHaveBeenCalledTimes(1);
    });
  },
);
