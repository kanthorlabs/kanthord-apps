import { describe, expect, it } from "vitest";

import type { MissionNodeRecord, NodeState } from "@/api/types";

import { claimedNodeCount, coolingFactsOf, projectsWithoutSetup } from "./overview-summary";

function node(id: string, state: NodeState, retiredAt: number | null = null): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: id,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: retiredAt,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
    state,
    attempt: 1,
    priority: 0,
    depends_on: [],
  };
}

describe("claimedNodeCount", () => {
  it("counts the nodes in Executing and Evaluating", () => {
    expect(
      claimedNodeCount([
        node("a", "Executing"),
        node("b", "Evaluating"),
        node("c", "Waiting"),
        node("d", "Executing", 7),
      ]),
    ).toBe(2);
  });
});

describe("coolingFactsOf", () => {
  const project = {
    id: "p",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/p",
  };

  function agentView(agent: string, cooling: { code: string; available_at: number } | null) {
    return {
      agent,
      worker: "coder@1",
      worker_binding_id: "binding_1",
      binding_set_version: 1,
      defaults: null,
      entry: null,
      effective: null,
      chain: [],
      active_position: null,
      cooling,
      valid: true,
      issues: [],
    };
  }

  it("lists each agent whose chain cools down, with its binding and end", () => {
    const facts = coolingFactsOf([
      {
        project,
        missionVersion: 1,
        nodes: [],
        jobs: null,
        registrations: null,
        executions: null,
        bindings: [
          {
            binding: {
              id: "binding_1",
              project_id: "p",
              name: "coder-main",
              kind: "worker",
              resource_identity: "worker:kanthord:coder-main",
              revision: 1,
              config: { worker: "coder@1", instance_count: 1 },
              created_at: 1,
              removed_at: null,
            },
            agents: [
              agentView("swe@1", { code: "agent.configuration.chain_cooling", available_at: 99 }),
              agentView("re@1", null),
            ],
          },
        ],
        environments: null,
      },
    ]);

    expect(facts).toEqual([
      { key: "p:binding_1:swe@1", agent: "swe@1", binding: "coder-main", project, availableAt: 99 },
    ]);
  });

  it("lists nothing while the bindings are unread", () => {
    expect(
      coolingFactsOf([
        {
          project,
          missionVersion: 1,
          nodes: [],
          jobs: null,
          registrations: null,
          executions: null,
          bindings: null,
          environments: null,
        },
      ]),
    ).toEqual([]);
  });
});

describe("projectsWithoutSetup", () => {
  const atlas = {
    id: "p1",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/p1",
  };
  const beta = { ...atlas, id: "p2", name: "beta" };

  function snapshotOf(project: typeof atlas) {
    return {
      project,
      missionVersion: 1,
      nodes: [],
      jobs: [],
      registrations: [],
      executions: [],
      bindings: null,
      environments: null,
    };
  }

  it("counts each snapshot project that the setup read omits", () => {
    expect(projectsWithoutSetup([snapshotOf(atlas), snapshotOf(beta)], [{ project: atlas }])).toBe(
      1,
    );
  });

  it("counts none when the setup read holds every snapshot project", () => {
    expect(projectsWithoutSetup([snapshotOf(atlas)], [{ project: atlas }, { project: beta }])).toBe(
      0,
    );
  });
});
