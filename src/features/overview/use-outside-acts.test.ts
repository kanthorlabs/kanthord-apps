import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkNode } from "@/api/resources/mission";
import type { MissionExternalAction, MissionNodeRecord } from "@/api/types";
import { detailKeyOf, type AttentionDetail, type OutsideAttentionItem } from "@/lib/attention";

import { useOutsideActs } from "./use-outside-acts";

vi.mock("@/api/resources/mission", () => ({ checkNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const NODE: MissionNodeRecord = {
  id: "node_1",
  intent: "implement",
  tags: [],
  tasks: [],
  filename: "node_1.md",
  mission_id: "mission_1",
  visible_revision: 1,
  content: {
    name: "Stripe webhook",
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
  state: "External.Requested",
  attempt: 1,
  priority: 0,
  depends_on: [],
};

const ACTION: MissionExternalAction = {
  node_id: "node_1",
  attempt: 1,
  action: {
    key: "repo.pull_request",
    binding_id: "binding_1",
    action: "pull_request",
    expected_end_state: "pull_request_merged",
    follows: null,
    configuration: { base_branch: "main", landing: "human" },
  },
  requested: true,
  request_evidence_id: "evidence_1",
  resolution: "unresolved",
};

const ITEM: OutsideAttentionItem = {
  id: "merge_wait:node_1",
  group: "outside",
  kind: "merge_wait",
  project: {
    id: "prj-1",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/state/prj-1",
  },
  subject: "Stripe webhook",
  at: null,
  missionVersion: 7,
  node: NODE,
  nodes: [NODE],
  cause: "Waits for merge",
  request: { action: ACTION, evidence: null },
};

const DETAIL: AttentionDetail = {
  kind: "external",
  key: detailKeyOf(NODE),
  actions: { status: "ready", data: [ACTION] },
  evidence: { status: "ready", data: [] },
  refreshFault: null,
};

beforeEach(() => {
  vi.mocked(checkNode).mockReset().mockResolvedValue({ results: [], failures: [] });
});

describe("useOutsideActs", () => {
  it("offers the check after the read of the external actions", () => {
    const context = { reload: vi.fn(), markActed: vi.fn() };

    expect(
      renderHook(() => useOutsideActs(ITEM, null, context)).result.current.check.available,
    ).toBe(false);
    expect(
      renderHook(() => useOutsideActs(ITEM, DETAIL, context)).result.current.check.available,
    ).toBe(true);
  });

  it("marks the item acted and reads the inbox again after a check", async () => {
    const context = { reload: vi.fn(), markActed: vi.fn() };
    const { result } = renderHook(() => useOutsideActs(ITEM, DETAIL, context));

    await act(async () => result.current.check.check());

    expect(checkNode).toHaveBeenCalledWith("node_1", { expected_mission_version: 7 });
    expect(context.markActed).toHaveBeenCalledWith("merge_wait:node_1");
    expect(context.reload).toHaveBeenCalledTimes(1);
  });
});
