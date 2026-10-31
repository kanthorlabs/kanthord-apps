import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { MissionNodeRecord, Project, WorkbenchSessionListItem } from "@/api/types";
import type { PolledResource } from "@/hooks/use-polled-resource";

import type { OverviewSnapshot, ProjectRead } from "./read-overview-snapshot";

vi.mock("./use-overview-snapshot", () => ({ useOverviewSnapshot: vi.fn() }));
vi.mock("./use-overview-setup", () => ({
  useOverviewSetup: () => ({
    data: null,
    error: null,
    loading: false,
    updatedAt: 1,
    now: 10_000_000,
    refresh: () => undefined,
  }),
}));
vi.mock("./use-attention-details", () => ({
  useAttentionDetails: () => ({ details: new Map(), refresh: () => undefined }),
}));

import { useOverviewSnapshot } from "./use-overview-snapshot";
import { useOverview } from "./use-overview";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const BETA: Project = { ...ATLAS, id: "prj-2", name: "beta" };

const SESSION: WorkbenchSessionListItem = {
  id: "s1",
  agent_name: "swe@1",
  name: null,
  created: 1,
  modified: 2,
  message_count: 1,
  first_message: "Create",
  run_active: true,
  pending_approval: { tool_call_id: "c1", operation_id: "project.create" },
};

function blocked(id: string): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: `Node ${id}`,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
    state: "Blocked",
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

function readOf(project: Project, nodeId: string): ProjectRead {
  return {
    project,
    mission: { id: `mission_${project.id}`, project_id: project.id, version: 1 },
    nodes: [blocked(nodeId)],
    jobs: [],
    registrations: [],
    executions: [],
    environments: [],
  };
}

const SNAPSHOT: OverviewSnapshot = {
  projects: [ATLAS, BETA],
  reads: [readOf(ATLAS, "a1"), readOf(BETA, "b1")],
  sessions: [SESSION],
  faults: [],
};

function render(entry: string) {
  const polled: PolledResource<OverviewSnapshot> = {
    data: SNAPSHOT,
    error: null,
    loading: false,
    updatedAt: 1,
    now: 10_000_000,
    refresh: () => undefined,
  };
  vi.mocked(useOverviewSnapshot).mockReturnValue(polled);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [entry] }, children);
  return renderHook(() => useOverview(), { wrapper });
}

function idsOf(items: readonly { readonly id: string }[]): readonly string[] {
  return items.map((item) => item.id).sort();
}

describe("useOverview board state", () => {
  it("derives the board items over every project", () => {
    const { boardItems, snapshots } = render("/").result.current;

    expect(idsOf(boardItems)).toEqual(["blocked:a1", "blocked:b1", "tool_approval:s1"]);
    expect(snapshots.map((entry) => entry.project.id)).toEqual(["prj-1", "prj-2"]);
  });

  it("keeps the board items and the sessions under a project filter and scopes the old fields", () => {
    const state = render("/?project=prj-2").result.current;

    expect(idsOf(state.boardItems)).toEqual(["blocked:a1", "blocked:b1", "tool_approval:s1"]);
    expect(state.snapshots).toHaveLength(2);
    expect(state.projectId).toBe("prj-2");
    expect(idsOf(state.groups.flatMap((entry) => entry.items))).toEqual(["blocked:b1"]);
  });

  it("answers the held nodes of each board item", () => {
    const { held } = render("/").result.current;

    expect(held.get("blocked:a1")).toEqual(["a1"]);
    expect(held.get("tool_approval:s1")).toEqual([]);
  });
});
