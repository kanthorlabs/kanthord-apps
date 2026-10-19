import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentSummary,
  BindingSet,
  MissionNodeRecord,
  Project,
  WorkerBindingRecord,
  WorkerInstanceRecord,
} from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");

import { useProjectReadiness } from "./use-project-readiness";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 2,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const FULL_SET: BindingSet = {
  version: 2,
  bindings: {
    "kanthord-repo": {
      kind: "repository",
      config: {
        available: true,
        platform: "github",
        address: "kanthorlabs/kanthord",
        strategy: { base_branch: "main" },
        ssh_credential: "atlas-ssh",
      },
    },
    "general-main": { kind: "worker", config: { worker: "coder@1", instance_count: 1 } },
    "idle-main": { kind: "worker", config: { worker: "coder@1", instance_count: 0 } },
  },
};

function workerBinding(name: string): WorkerBindingRecord {
  return {
    id: `binding-${name}`,
    project_id: PROJECT.id,
    name,
    kind: "worker",
    resource_identity: `worker:kanthord:${name}`,
    revision: 1,
    config: { worker: "coder@1", instance_count: 1 },
    created_at: 1,
    removed_at: null,
  };
}

const INSTANCE: WorkerInstanceRecord = {
  runtime_identity: "instance-1",
  project_id: PROJECT.id,
  resource_identity: "worker:kanthord:general-main",
  worker_name: "coder@1",
  host: "kanthord",
  placement: "server",
  activity: "idle",
  draining: false,
  registered: true,
};

function agent(agentName: string, enabled: boolean): AgentSummary {
  return {
    agentName,
    workerNames: [agentName === "swe@1" ? "coder@1" : "reviewer@1"],
    enablement: enabled
      ? {
          agent_name: agentName,
          state: "enabled",
          agent_providers: [],
          default_configuration: {
            agent_provider: "router",
            model_identifier: "qwen",
            reasoning_effort: "off",
          },
          fallback_configurations: [],
          revision: 1,
        }
      : null,
  };
}

const NODE = { id: "node-1" } as MissionNodeRecord;

function serveFull() {
  vi.mocked(projectsApi.readBindingSet).mockResolvedValue(FULL_SET);
  vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
    workerBinding("general-main"),
    workerBinding("idle-main"),
  ]);
  vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([INSTANCE]);
  vi.mocked(workersApi.listAgents).mockResolvedValue([agent("swe@1", true), agent("re@1", false)]);
  vi.mocked(missionApi.readMission).mockResolvedValue({
    id: "mission-1",
    project_id: PROJECT.id,
    version: 2,
  });
  vi.mocked(missionApi.listMissionNodes).mockResolvedValue([NODE]);
}

async function readinessOf(project: Project) {
  const { result } = renderHook(() => useProjectReadiness(project));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
}

function statesOf(items: readonly { key: string; state: string }[]): readonly string[] {
  return items.map((item) => `${item.key}:${item.state}`);
}

describe("useProjectReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks every step done for a ready project", async () => {
    serveFull();

    const readiness = await readinessOf(PROJECT);

    expect(statesOf(readiness.items)).toEqual([
      "repository_binding:done",
      "worker_bindings:done",
      "live_instances:done",
      "enabled_agents:done",
      "plan_import:done",
      "project_active:done",
    ]);
    expect(readiness.faults).toEqual([]);
    expect(readiness.items[0]?.link).toEqual({
      label: "Open bindings",
      path: "/projects/prj-1?tab=bindings",
    });
  });

  it("marks every step open for a new project", async () => {
    serveFull();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([]);
    vi.mocked(missionApi.listMissionNodes).mockResolvedValue([]);

    const readiness = await readinessOf({ ...PROJECT, paused_at: 5 });

    expect(statesOf(readiness.items)).toEqual([
      "repository_binding:open",
      "worker_bindings:open",
      "live_instances:open",
      "enabled_agents:open",
      "plan_import:open",
      "project_active:open",
    ]);
  });

  it("names the worker binding without a live instance", async () => {
    serveFull();
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([]);

    const readiness = await readinessOf(PROJECT);

    expect(readiness.items.find((item) => item.key === "live_instances")).toMatchObject({
      state: "open",
      detail: "No live instance:",
      names: ["general-main"],
      link: { label: "Open workers", path: "/workers?project=prj-1" },
    });
  });

  it("does not count a draining or an unregistered instance as live", async () => {
    serveFull();
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([
      { ...INSTANCE, draining: true },
      { ...INSTANCE, runtime_identity: "instance-2", registered: false },
    ]);

    const readiness = await readinessOf(PROJECT);

    expect(readiness.items.find((item) => item.key === "live_instances")).toMatchObject({
      state: "open",
      names: ["general-main"],
    });
  });

  it("names the missing worker binding in the instance and agent steps", async () => {
    serveFull();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });

    const readiness = await readinessOf(PROJECT);

    expect(
      readiness.items
        .filter((item) => item.key === "live_instances" || item.key === "enabled_agents")
        .map((item) => item.detail),
    ).toEqual(["The project holds no worker binding.", "The project holds no worker binding."]);
  });

  it("names the agent of a worker binding that is not enabled", async () => {
    serveFull();
    vi.mocked(workersApi.listAgents).mockResolvedValue([agent("swe@1", false)]);

    const readiness = await readinessOf(PROJECT);

    expect(readiness.items.find((item) => item.key === "enabled_agents")).toMatchObject({
      state: "open",
      detail: "Not enabled:",
      names: ["swe@1"],
      link: { label: "Enable swe@1", path: "/agents/swe%401#enablement" },
    });
  });

  it("reports a failed read and keeps the other steps", async () => {
    serveFull();
    vi.mocked(workersApi.listWorkerInstances).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    const readiness = await readinessOf(PROJECT);

    expect(readiness.faults).toEqual([
      {
        projectId: PROJECT.id,
        projectName: PROJECT.name,
        source: "worker instances",
        message: "The daemon did not answer.",
      },
    ]);
    expect(statesOf(readiness.items)).toEqual([
      "repository_binding:done",
      "worker_bindings:done",
      "live_instances:open",
      "enabled_agents:done",
      "plan_import:done",
      "project_active:done",
    ]);
  });
});
