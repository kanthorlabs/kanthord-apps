import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as instancesApi from "@/api/resources/worker-instances";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentSummary,
  BindingSet,
  EnvironmentState,
  MissionNodeRecord,
  Project,
  WorkerBindingRecord,
  WorkerInstanceListItem,
  WorkerRegistrationRecord,
} from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/worker-instances");

import { useProjectReadiness, type ReadinessItem } from "./use-project-readiness";

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

const REGISTRATION: WorkerRegistrationRecord = {
  runtime_identity: "registration-1",
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
  vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION]);
  vi.mocked(workersApi.listAgents).mockResolvedValue([agent("swe@1", true), agent("re@1", false)]);
  vi.mocked(missionApi.readMission).mockResolvedValue({
    id: "mission-1",
    project_id: PROJECT.id,
    version: 2,
  });
  vi.mocked(missionApi.listMissionNodes).mockResolvedValue([NODE]);
  vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([]);
  vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([]);
}

function instance(name: string, connected: boolean): WorkerInstanceListItem {
  return {
    id: `worker_instance_${name}`,
    name,
    worker: "coder@1",
    revision: 1,
    public_key: "key",
    fingerprint: "SHA256:key",
    created_at: 1,
    ended_at: null,
    connection: connected ? { connection_name: name, connected_at: 1, last_heartbeat_at: 1 } : null,
    binding_count: 1,
    holder_mismatch: false,
  };
}

function servePlaced(instances: readonly string[]) {
  vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
    ...FULL_SET,
    bindings: {
      ...FULL_SET.bindings,
      "general-main": {
        kind: "worker",
        config: { worker: "coder@1", placement: "worker", worker_instances: instances },
      },
    },
  });
}

function environmentState(
  bindingName: string,
  status: EnvironmentState["status"],
  overrides: Partial<EnvironmentState> = {},
): EnvironmentState {
  return {
    binding_id: `binding-${bindingName}`,
    binding_name: bindingName,
    resource_identity: `repository:${bindingName}`,
    target: "image",
    source: "stored",
    status,
    digest: null,
    tag: null,
    run_started_at: null,
    step_started_at: null,
    reason: null,
    reason_started_at: null,
    failure: null,
    checks: [],
    repairs: 0,
    repairing: false,
    ...overrides,
  };
}

const READY_ENVIRONMENTS: readonly EnvironmentState[] = [
  environmentState("engine", "ready"),
  environmentState("web", "none"),
];

async function readinessOf(
  project: Project,
  environments: readonly EnvironmentState[] | null = READY_ENVIRONMENTS,
) {
  const { result } = renderHook(() => useProjectReadiness(project, environments));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
}

function itemsOf(readiness: {
  readonly openItems: readonly ReadinessItem[];
  readonly doneItems: readonly ReadinessItem[];
}): readonly ReadinessItem[] {
  return [...readiness.openItems, ...readiness.doneItems];
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

    expect(statesOf(itemsOf(readiness))).toEqual([
      "repository_binding:done",
      "worker_bindings:done",
      "live_registrations:done",
      "enabled_agents:done",
      "environment:done",
      "plan_import:done",
      "project_active:done",
    ]);
    expect(readiness.faults).toEqual([]);
    expect(itemsOf(readiness)[0]?.link).toEqual({
      label: "Open bindings",
      path: "/projects/prj-1?tab=bindings",
    });
  });

  it("marks every step open for a new project", async () => {
    serveFull();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(missionApi.listMissionNodes).mockResolvedValue([]);

    const readiness = await readinessOf({ ...PROJECT, paused_at: 5 });

    expect(statesOf(itemsOf(readiness))).toEqual([
      "repository_binding:open",
      "worker_bindings:open",
      "live_registrations:open",
      "enabled_agents:open",
      "plan_import:open",
      "project_active:open",
      "environment:done",
    ]);
  });

  it("names the worker binding without a live registration", async () => {
    serveFull();
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);

    const readiness = await readinessOf(PROJECT);

    expect(itemsOf(readiness).find((item) => item.key === "live_registrations")).toMatchObject({
      state: "open",
      detail: "No live registration:",
      names: ["general-main"],
      link: { label: "Open workers", path: "/workers?project=prj-1" },
    });
  });

  it("does not count a draining or an ended registration as live", async () => {
    serveFull();
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([
      { ...REGISTRATION, draining: true },
      { ...REGISTRATION, runtime_identity: "registration-2", registered: false },
    ]);

    const readiness = await readinessOf(PROJECT);

    expect(itemsOf(readiness).find((item) => item.key === "live_registrations")).toMatchObject({
      state: "open",
      names: ["general-main"],
    });
  });

  it("names the missing worker binding in the registration and agent steps", async () => {
    serveFull();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });

    const readiness = await readinessOf(PROJECT);

    expect(
      itemsOf(readiness)
        .filter((item) => item.key === "live_registrations" || item.key === "enabled_agents")
        .map((item) => item.detail),
    ).toEqual(["The project holds no worker binding.", "The project holds no worker binding."]);
  });

  it("names the agent of a worker binding that is not enabled", async () => {
    serveFull();
    vi.mocked(workersApi.listAgents).mockResolvedValue([agent("swe@1", false)]);

    const readiness = await readinessOf(PROJECT);

    expect(itemsOf(readiness).find((item) => item.key === "enabled_agents")).toMatchObject({
      state: "open",
      detail: "Not enabled:",
      names: ["swe@1"],
      link: { label: "Enable swe@1", path: "/agents/swe%401#enablement" },
    });
  });

  it("opens the agents sheet of the first live agent-provider credential", async () => {
    serveFull();
    vi.mocked(workersApi.listAgents).mockResolvedValue([agent("swe@1", false)]);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([
      {
        name: "old-router",
        platform: "openrouter",
        holder: "server",
        sealed_to: null,
        sealed_current: true,
        revisions: [{ id: "c-1", revision: 1, metadata: null, created_at: 1, ended_at: 2 }],
      },
      {
        name: "gem",
        platform: "gemini",
        holder: "server",
        sealed_to: null,
        sealed_current: true,
        revisions: [],
      },
      {
        name: "router-main",
        platform: "openrouter",
        holder: "server",
        sealed_to: null,
        sealed_current: true,
        revisions: [{ id: "c-2", revision: 1, metadata: null, created_at: 1, ended_at: null }],
      },
    ]);

    const readiness = await readinessOf(PROJECT);

    expect(credentialsApi.listAllCredentials).toHaveBeenCalledWith("llm", "server");
    expect(itemsOf(readiness).find((item) => item.key === "enabled_agents")?.link).toEqual({
      label: "Enable agents",
      path: "/llm/router-main#enable-agents",
    });
  });

  it("reports a failed read and keeps the other steps", async () => {
    serveFull();
    vi.mocked(workersApi.listWorkerRegistrations).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    const readiness = await readinessOf(PROJECT);

    expect(readiness.faults).toEqual([
      {
        projectId: PROJECT.id,
        projectName: PROJECT.name,
        source: "worker registrations",
        message: "The daemon did not answer.",
      },
    ]);
    expect(statesOf(itemsOf(readiness))).toEqual([
      "live_registrations:open",
      "repository_binding:done",
      "worker_bindings:done",
      "enabled_agents:done",
      "environment:done",
      "plan_import:done",
      "project_active:done",
    ]);
  });

  it("names a listed instance that is not connected at the worker placement", async () => {
    serveFull();
    servePlaced(["mac-studio", "build-01"]);
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([
      instance("mac-studio", true),
      instance("build-01", false),
    ]);

    const readiness = await readinessOf(PROJECT);

    expect(instancesApi.listWorkerInstances).toHaveBeenCalledWith(null);
    expect(itemsOf(readiness).find((item) => item.key === "live_registrations")).toMatchObject({
      state: "open",
      detail: "Instance",
      names: ["build-01"],
      after: "is not connected. Start kanthord serve worker with its configuration.",
    });
  });

  it("counts a worker placement binding with connected instances by its registrations", async () => {
    serveFull();
    servePlaced(["mac-studio"]);
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([instance("mac-studio", true)]);

    const readiness = await readinessOf(PROJECT);

    expect(itemsOf(readiness).find((item) => item.key === "live_registrations")).toMatchObject({
      state: "done",
      detail: "Each worker binding runs a live registration.",
    });
  });

  it("reports a failed instance read and states the absence in the registration step", async () => {
    serveFull();
    servePlaced(["mac-studio"]);
    vi.mocked(instancesApi.listWorkerInstances).mockRejectedValue(
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
    expect(itemsOf(readiness).find((item) => item.key === "live_registrations")).toMatchObject({
      state: "open",
      detail: "The worker instances were not read.",
      names: [],
    });
  });

  describe("the Environment item", () => {
    const BINDINGS_LINK = { label: "Open bindings", path: "/projects/prj-1?tab=bindings" };

    async function environmentItemOf(environments: readonly EnvironmentState[] | null) {
      serveFull();
      const readiness = await readinessOf(PROJECT, environments);
      return itemsOf(readiness).find((item) => item.key === "environment");
    }

    it("sits between Enabled agents and Plan import", async () => {
      serveFull();

      const readiness = await readinessOf(PROJECT);

      expect(itemsOf(readiness).map((item) => item.key)).toEqual([
        "repository_binding",
        "worker_bindings",
        "live_registrations",
        "enabled_agents",
        "environment",
        "plan_import",
        "project_active",
      ]);
    });

    it("is done when every state is none or ready", async () => {
      expect(await environmentItemOf(READY_ENVIRONMENTS)).toMatchObject({
        state: "done",
        detail: "Each repository binding holds a ready environment or needs none.",
        link: BINDINGS_LINK,
      });
    });

    it("is done for an empty state list", async () => {
      expect(await environmentItemOf([])).toMatchObject({ state: "done" });
    });

    it("names each binding that is not ready and links the first failed one", async () => {
      const item = await environmentItemOf([
        environmentState("engine", "failed", {
          failure: {
            class: "command_absent",
            origin: "onboarding",
            execution_id: null,
            command: "pnpm",
            exit_code: 127,
            tail: "",
            reproduce: "",
            ended_at: 1,
          },
        }),
        environmentState("web", "building"),
      ]);

      expect(item).toMatchObject({
        state: "open",
        detail: "engine: failed, command_absent; web: building.",
        link: {
          label: "Open bindings",
          path: "/projects/prj-1?tab=bindings&environment=engine",
        },
      });
    });

    it("links the Bindings tab when no state failed", async () => {
      expect(await environmentItemOf([environmentState("web", "building")])).toMatchObject({
        state: "open",
        detail: "web: building.",
        link: BINDINGS_LINK,
      });
    });

    it("is open and states an absence for null states", async () => {
      expect(await environmentItemOf(null)).toMatchObject({
        state: "open",
        detail: "No environment state is known.",
        link: BINDINGS_LINK,
      });
    });

    it("keeps a ready environment done and names its red check", async () => {
      const item = await environmentItemOf([
        environmentState("engine", "ready", {
          checks: [
            { command: "pnpm lint", exit_code: 0 },
            { command: "pnpm test", exit_code: 1 },
          ],
        }),
      ]);

      expect(item).toMatchObject({
        state: "done",
        detail: "engine: ready, red check pnpm test.",
      });
    });

    it("names every red check of a ready environment", async () => {
      const item = await environmentItemOf([
        environmentState("engine", "ready", {
          checks: [
            { command: "pnpm test", exit_code: 1 },
            { command: "pnpm lint", exit_code: 2 },
          ],
        }),
      ]);

      expect(item).toMatchObject({
        state: "done",
        detail: "engine: ready, red check pnpm test; engine: ready, red check pnpm lint.",
      });
    });
  });
});
