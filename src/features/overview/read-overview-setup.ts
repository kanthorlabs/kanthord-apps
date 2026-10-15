import { connectionBaseUrl } from "@/api/client";
import { ApiError } from "@/api/errors";
import { listAllCredentials } from "@/api/resources/credentials";
import { readLiveness } from "@/api/resources/gateway";
import { listBindingAgents, listProjects, listWorkerBindings } from "@/api/resources/projects";
import { listWorkerCatalog } from "@/api/resources/workers";
import type {
  BindingAgentView,
  Credential,
  LivenessReport,
  Project,
  WorkerBindingRecord,
  WorkerCatalogItem,
} from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

import { settle, type ReadFault } from "./read-overview-snapshot";

export interface BindingRead {
  readonly binding: WorkerBindingRecord;
  readonly agents: readonly BindingAgentView[] | null;
}

export interface ProjectSetup {
  readonly project: Project;
  readonly bindings: readonly BindingRead[] | null;
}

export interface OverviewSetup {
  readonly catalog: readonly WorkerCatalogItem[] | null;
  readonly credentials: readonly Credential[] | null;
  readonly liveness: LivenessReport | null;
  readonly livenessFailure: string | null;
  readonly projects: readonly ProjectSetup[];
  readonly faults: readonly ReadFault[];
}

async function readLivenessReport(): Promise<LivenessReport> {
  const baseUrl = connectionBaseUrl();
  if (baseUrl === null) throw new ApiError("unreachable", "No instance is connected.", 0);
  return readLiveness(baseUrl);
}

async function readProjectSetup(
  project: Project,
  previous: ProjectSetup | null,
): Promise<{ readonly setup: ProjectSetup; readonly faults: readonly ReadFault[] }> {
  const records = await settle(
    project,
    "worker bindings",
    () => listWorkerBindings(project.id),
    previous?.bindings?.map((entry) => entry.binding) ?? null,
  );
  const reads = await Promise.all(
    (records.data ?? []).map(async (binding) => {
      const before = previous?.bindings?.find((entry) => entry.binding.id === binding.id);
      const agents = await settle(
        project,
        `agents of ${binding.name}`,
        () => listBindingAgents(project.id, binding.id),
        before?.agents ?? null,
      );
      return { read: { binding, agents: agents.data }, fault: agents.fault };
    }),
  );
  return {
    setup: {
      project,
      bindings: records.data === null ? null : reads.map((entry) => entry.read),
    },
    faults: [records.fault, ...reads.map((entry) => entry.fault)].flatMap((fault) =>
      fault === null ? [] : [fault],
    ),
  };
}

export async function readOverviewSetup(previous: OverviewSetup | null): Promise<OverviewSetup> {
  const projects = await listProjects();
  const [catalog, credentials, liveness, perProject] = await Promise.all([
    settle(null, "worker catalog", listWorkerCatalog, previous?.catalog ?? null),
    settle(null, "LLM credentials", () => listAllCredentials("llm"), previous?.credentials ?? null),
    readLivenessReport().then(
      (report) => ({ report, failure: null }),
      (cause: unknown) => ({ report: null, failure: asApiError(cause).message }),
    ),
    Promise.all(
      projects.map((project) =>
        readProjectSetup(
          project,
          previous?.projects.find((entry) => entry.project.id === project.id) ?? null,
        ),
      ),
    ),
  ]);
  return {
    catalog: catalog.data,
    credentials: credentials.data,
    liveness: liveness.report,
    livenessFailure: liveness.failure,
    projects: perProject.map((entry) => entry.setup),
    faults: [
      catalog.fault,
      credentials.fault,
      ...perProject.flatMap((entry) => entry.faults),
    ].flatMap((fault) => (fault === null ? [] : [fault])),
  };
}
