import type { AgentSummary, BindingSet, BindingSetKind, Credential, Project } from "@/api/types";

import { isArchived } from "./credential-revisions";

export type OnboardingStepKey =
  "llm_credential" | "agents" | "ssh_key" | "project" | "repository_binding" | "worker_bindings";

export type OnboardingStepState = "done" | "next" | "open";

export interface OnboardingAction {
  readonly label: string;
  readonly path: string;
  readonly returns: boolean;
}

export interface OnboardingStep {
  readonly key: OnboardingStepKey;
  readonly title: string;
  readonly description: string;
  readonly state: OnboardingStepState;
  readonly action: OnboardingAction;
}

export interface ProjectBindingSet {
  readonly project: Project;
  readonly bindingSet: BindingSet | null;
}

export interface OnboardingFacts {
  readonly llmCredentials: readonly Credential[] | null;
  readonly agents: readonly AgentSummary[] | null;
  readonly repositoryCredentials: readonly Credential[] | null;
  readonly projects: readonly ProjectBindingSet[] | null;
}

interface StepDraft {
  readonly key: OnboardingStepKey;
  readonly title: string;
  readonly description: string;
  readonly done: boolean;
  readonly action: OnboardingAction;
}

const NEW_PROJECT: OnboardingAction = {
  label: "New project",
  path: "/projects/new",
  returns: true,
};

function hasLiveCredential(credentials: readonly Credential[] | null, platform?: string): boolean {
  return (credentials ?? []).some(
    (credential) =>
      !isArchived(credential) && (platform === undefined || credential.platform === platform),
  );
}

function isEnabled(agent: AgentSummary): boolean {
  return agent.enablement?.state === "enabled";
}

function agentsAction(agents: readonly AgentSummary[] | null): OnboardingAction {
  const first = (agents ?? []).find((agent) => !isEnabled(agent));
  if (first === undefined) return { label: "Open agents", path: "/agents", returns: true };
  return {
    label: `Enable ${first.agentName}`,
    path: `/agents/${encodeURIComponent(first.agentName)}#enablement`,
    returns: true,
  };
}

function holdsBinding(entry: ProjectBindingSet, kind: BindingSetKind): boolean {
  return Object.values(entry.bindingSet?.bindings ?? {}).some((binding) => binding.kind === kind);
}

function bindingStep(
  projects: readonly ProjectBindingSet[] | null,
  kind: BindingSetKind,
): { readonly done: boolean; readonly action: OnboardingAction } {
  const entries = projects ?? [];
  const target = entries.find((entry) => !holdsBinding(entry, kind)) ?? entries[0];
  return {
    done: entries.some((entry) => holdsBinding(entry, kind)),
    action:
      target === undefined
        ? NEW_PROJECT
        : {
            label: "Open bindings",
            path: `/projects/${encodeURIComponent(target.project.id)}?tab=bindings`,
            returns: true,
          },
  };
}

function draftsOf(facts: OnboardingFacts): readonly StepDraft[] {
  const repository = bindingStep(facts.projects, "repository");
  const worker = bindingStep(facts.projects, "worker");
  return [
    {
      key: "llm_credential",
      title: "LLM credential",
      description: "Add the API key or the sign-in that the agents use to call a model.",
      done: hasLiveCredential(facts.llmCredentials),
      action: { label: "New LLM credential", path: "/llm/new", returns: true },
    },
    {
      key: "agents",
      title: "Enabled agents",
      description: "Enable an agent of the hosted workers with an LLM credential.",
      done: (facts.agents ?? []).some(isEnabled),
      action: agentsAction(facts.agents),
    },
    {
      key: "ssh_key",
      title: "SSH key",
      description:
        "Add the SSH key that clones and pushes the repository. Then open Overview to return here.",
      done: hasLiveCredential(facts.repositoryCredentials, "ssh"),
      action: { label: "Open repositories", path: "/repositories", returns: false },
    },
    {
      key: "project",
      title: "Project",
      description: "Create the project that holds the mission and its bindings.",
      done: (facts.projects ?? []).length > 0,
      action: NEW_PROJECT,
    },
    {
      key: "repository_binding",
      title: "Repository binding",
      description: "Bind the repository that the agents work on to the project.",
      ...repository,
    },
    {
      key: "worker_bindings",
      title: "Worker bindings",
      description: "Bind the workers that claim the nodes of the mission.",
      ...worker,
    },
  ];
}

export function onboardingStepsOf(facts: OnboardingFacts): readonly OnboardingStep[] {
  const drafts = draftsOf(facts);
  const next = drafts.findIndex((draft) => !draft.done);
  return drafts.map((draft, index) => ({
    key: draft.key,
    title: draft.title,
    description: draft.description,
    state: draft.done ? "done" : index === next ? "next" : "open",
    action: draft.action,
  }));
}

export function hasOpenStep(steps: readonly OnboardingStep[]): boolean {
  return steps.some((step) => step.state !== "done");
}

export type StepBadgeVariant = "default" | "secondary" | "outline";

const STATE_LABELS: Readonly<Record<OnboardingStepState, string>> = {
  done: "Done",
  next: "Next",
  open: "Open",
};

const STATE_VARIANTS: Readonly<Record<OnboardingStepState, StepBadgeVariant>> = {
  done: "secondary",
  next: "default",
  open: "outline",
};

export function stepStateLabel(state: OnboardingStepState): string {
  return STATE_LABELS[state];
}

export function stepStateVariant(state: OnboardingStepState): StepBadgeVariant {
  return STATE_VARIANTS[state];
}
