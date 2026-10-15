import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/client", () => ({ connectionBaseUrl: vi.fn() }));
vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
  listWorkerBindings: vi.fn(),
  listBindingAgents: vi.fn(),
}));
vi.mock("@/api/resources/workers", () => ({ listWorkerCatalog: vi.fn() }));
vi.mock("@/api/resources/credentials", () => ({ listAllCredentials: vi.fn() }));
vi.mock("@/api/resources/gateway", () => ({ readLiveness: vi.fn() }));

import { connectionBaseUrl } from "@/api/client";
import { listAllCredentials } from "@/api/resources/credentials";
import { readLiveness } from "@/api/resources/gateway";
import { listBindingAgents, listProjects, listWorkerBindings } from "@/api/resources/projects";
import { listWorkerCatalog } from "@/api/resources/workers";
import type { BindingAgentView, Project, WorkerBindingRecord } from "@/api/types";

import { readOverviewSetup } from "./read-overview-setup";

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const BINDING: WorkerBindingRecord = {
  id: "binding_1",
  project_id: "prj-1",
  name: "coder-main",
  kind: "worker",
  resource_identity: "worker:kanthord:coder-main",
  revision: 1,
  config: { worker: "coder@1", instance_count: 1 },
  created_at: 1,
  removed_at: null,
};

const AGENT = { agent: "swe@1", valid: true } as BindingAgentView;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listProjects).mockResolvedValue([PROJECT]);
  vi.mocked(listWorkerCatalog).mockResolvedValue([]);
  vi.mocked(listAllCredentials).mockResolvedValue([]);
  vi.mocked(listWorkerBindings).mockResolvedValue([BINDING]);
  vi.mocked(listBindingAgents).mockResolvedValue([AGENT]);
  vi.mocked(connectionBaseUrl).mockReturnValue("http://daemon.test");
  vi.mocked(readLiveness).mockResolvedValue({ healthy: true, services: {} });
});

describe("readOverviewSetup", () => {
  it("reads the catalog, the credentials, the liveness, and the bindings with their agents", async () => {
    const setup = await readOverviewSetup(null);

    expect(setup.catalog).toEqual([]);
    expect(setup.credentials).toEqual([]);
    expect(setup.liveness).toEqual({ healthy: true, services: {} });
    expect(setup.livenessFailure).toBeNull();
    expect(setup.projects).toEqual([
      { project: PROJECT, bindings: [{ binding: BINDING, agents: [AGENT] }] },
    ]);
    expect(setup.faults).toEqual([]);
    expect(readLiveness).toHaveBeenCalledWith("http://daemon.test");
    expect(listAllCredentials).toHaveBeenCalledWith("llm");
    expect(listBindingAgents).toHaveBeenCalledWith("prj-1", "binding_1");
  });

  it("keeps the last good data of a failed read and names the fault", async () => {
    const first = await readOverviewSetup(null);
    vi.mocked(listWorkerCatalog).mockRejectedValue(new ApiError("unreachable", "No answer.", 0));
    vi.mocked(listBindingAgents).mockRejectedValue(new ApiError("unreachable", "No agents.", 0));

    const second = await readOverviewSetup(first);

    expect(second.catalog).toEqual([]);
    expect(second.projects[0]?.bindings?.[0]?.agents).toEqual([AGENT]);
    expect(second.faults.map((fault) => [fault.projectName, fault.source, fault.message])).toEqual([
      [null, "worker catalog", "No answer."],
      ["atlas", "agents of coder-main", "No agents."],
    ]);
  });

  it("answers no data for a source that never read", async () => {
    vi.mocked(listAllCredentials).mockRejectedValue(new ApiError("unreachable", "No answer.", 0));
    vi.mocked(listWorkerBindings).mockRejectedValue(new ApiError("unreachable", "No bindings.", 0));

    const setup = await readOverviewSetup(null);

    expect(setup.credentials).toBeNull();
    expect(setup.projects[0]?.bindings).toBeNull();
    expect(setup.faults).toHaveLength(2);
  });

  it("reports a failed liveness read apart from the record faults", async () => {
    vi.mocked(readLiveness).mockRejectedValue(new ApiError("unreachable", "No answer.", 0));

    const setup = await readOverviewSetup(null);

    expect(setup.liveness).toBeNull();
    expect(setup.livenessFailure).toBe("No answer.");
    expect(setup.faults).toEqual([]);
  });

  it("reports a liveness failure when no instance is connected", async () => {
    vi.mocked(connectionBaseUrl).mockReturnValue(null);

    const setup = await readOverviewSetup(null);

    expect(setup.livenessFailure).toBe("No instance is connected.");
    expect(readLiveness).not.toHaveBeenCalled();
  });
});
