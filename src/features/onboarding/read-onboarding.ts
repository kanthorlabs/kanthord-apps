import { listAllCredentials } from "@/api/resources/credentials";
import { listProjects, readBindingSet } from "@/api/resources/projects";
import { listAgents } from "@/api/resources/workers";
import { settle, type ReadFault } from "@/features/overview/read-overview-snapshot";
import type { OnboardingFacts, ProjectBindingSet } from "@/lib/onboarding";

export interface OnboardingRead {
  readonly facts: OnboardingFacts;
  readonly faults: readonly ReadFault[];
}

async function readProjectBindingSets(): Promise<{
  readonly projects: readonly ProjectBindingSet[] | null;
  readonly faults: readonly (ReadFault | null)[];
}> {
  const projects = await settle(null, "project list", listProjects, null);
  if (projects.data === null) return { projects: null, faults: [projects.fault] };
  const sets = await Promise.all(
    projects.data.map(async (project) => {
      const set = await settle(project, "binding set", () => readBindingSet(project.id), null);
      return { entry: { project, bindingSet: set.data }, fault: set.fault };
    }),
  );
  return { projects: sets.map((set) => set.entry), faults: sets.map((set) => set.fault) };
}

export async function readOnboarding(): Promise<OnboardingRead> {
  const [llmCredentials, agents, repositoryCredentials, projects] = await Promise.all([
    settle(null, "LLM credentials", () => listAllCredentials("llm", "server"), null),
    settle(null, "agents", listAgents, null),
    settle(null, "Git credentials", () => listAllCredentials("repository"), null),
    readProjectBindingSets(),
  ]);
  return {
    facts: {
      llmCredentials: llmCredentials.data,
      agents: agents.data,
      repositoryCredentials: repositoryCredentials.data,
      projects: projects.projects,
    },
    faults: [
      llmCredentials.fault,
      agents.fault,
      repositoryCredentials.fault,
      ...projects.faults,
    ].flatMap((fault) => (fault === null ? [] : [fault])),
  };
}
