import type { AgentSummary, BindingSet, BindingSetKind, Credential, Project } from "@/api/types";

import { isArchived } from "./credential-revisions";
import {
  CREATE_SSH_KEY_HASH,
  credentialSectionPath,
  enableAgentsPath,
} from "./credential-sections";

export type OnboardingStepKey =
  "llm_credential" | "agents" | "ssh_key" | "project" | "repository_binding" | "worker_bindings";

export type OnboardingStepState = "done" | "next" | "open";

export interface OnboardingAction {
  readonly label: string;
  readonly path: string;
}

export interface OnboardingStep {
  readonly key: OnboardingStepKey;
  readonly title: string;
  readonly description: string;
  readonly state: OnboardingStepState;
  readonly read: boolean;
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
  readonly read: boolean;
  readonly action: OnboardingAction;
}

const NEW_PROJECT: OnboardingAction = {
  label: "New project",
  path: "/projects/new",
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

function boundWorkersOf(target: ProjectBindingSet | undefined): ReadonlySet<string> {
  return new Set(
    Object.values(target?.bindingSet?.bindings ?? {}).flatMap((binding) =>
      binding.kind === "worker" ? [binding.config.worker] : [],
    ),
  );
}

function agentsAction(
  agents: readonly AgentSummary[] | null,
  boundWorkers: ReadonlySet<string>,
  llmCredentials: readonly Credential[] | null,
): OnboardingAction {
  const disabled = (agents ?? []).filter((agent) => !isEnabled(agent));
  const first =
    disabled.find((agent) => agent.workerNames.some((worker) => boundWorkers.has(worker))) ??
    disabled[0];
  if (first === undefined) return { label: "Open agents", path: "/agents" };
  const sheetPath = enableAgentsPath(llmCredentials);
  if (sheetPath !== null) return { label: "Enable agents", path: sheetPath };
  return {
    label: `Enable ${first.agentName}`,
    path: `/agents/${encodeURIComponent(first.agentName)}#enablement`,
  };
}

function holdsBinding(entry: ProjectBindingSet, kind: BindingSetKind): boolean {
  return Object.values(entry.bindingSet?.bindings ?? {}).some((binding) => binding.kind === kind);
}

function targetProjectOf(
  projects: readonly ProjectBindingSet[] | null,
): ProjectBindingSet | undefined {
  const entries = projects ?? [];
  return entries.find((entry) => holdsBinding(entry, "repository")) ?? entries[0];
}

function bindingStep(
  projects: readonly ProjectBindingSet[] | null,
  target: ProjectBindingSet | undefined,
  kind: BindingSetKind,
): Pick<StepDraft, "done" | "read" | "action"> {
  return {
    done: target !== undefined && holdsBinding(target, kind),
    read: projects !== null && (target === undefined || target.bindingSet !== null),
    action:
      target === undefined
        ? NEW_PROJECT
        : {
            label: "Open bindings",
            path: `/projects/${encodeURIComponent(target.project.id)}?tab=bindings`,
          },
  };
}

function draftsOf(facts: OnboardingFacts): readonly StepDraft[] {
  const target = targetProjectOf(facts.projects);
  return [
    {
      key: "llm_credential",
      title: "LLM credential",
      description: "Add the API key or the sign-in that the agents use to call a model.",
      done: hasLiveCredential(facts.llmCredentials),
      read: facts.llmCredentials !== null,
      action: { label: "New LLM credential", path: "/llm/new" },
    },
    {
      key: "agents",
      title: "Enabled agents",
      description: "Enable an agent of the hosted workers with an LLM credential.",
      done: (facts.agents ?? []).some(isEnabled),
      read: facts.agents !== null,
      action: agentsAction(facts.agents, boundWorkersOf(target), facts.llmCredentials),
    },
    {
      key: "ssh_key",
      title: "SSH key",
      description: "Create the SSH key that clones and pushes the repository.",
      done: hasLiveCredential(facts.repositoryCredentials, "ssh"),
      read: facts.repositoryCredentials !== null,
      action: {
        label: "Create SSH key",
        path: `${credentialSectionPath("repository")}${CREATE_SSH_KEY_HASH}`,
      },
    },
    {
      key: "project",
      title: "Project",
      description: "Create the project that holds the mission and its bindings.",
      done: (facts.projects ?? []).length > 0,
      read: facts.projects !== null,
      action: NEW_PROJECT,
    },
    {
      key: "repository_binding",
      title: "Repository binding",
      description: "Bind the repository that the agents work on to the project.",
      ...bindingStep(facts.projects, target, "repository"),
    },
    {
      key: "worker_bindings",
      title: "Worker bindings",
      description: "Bind the workers that claim the nodes of the mission.",
      ...bindingStep(facts.projects, target, "worker"),
    },
  ];
}

export function onboardingStepsOf(facts: OnboardingFacts): readonly OnboardingStep[] {
  const drafts = draftsOf(facts);
  const next = drafts.findIndex((draft) => draft.read && !draft.done);
  return drafts.map((draft, index) => ({
    key: draft.key,
    title: draft.title,
    description: draft.description,
    state: draft.done ? "done" : index === next ? "next" : "open",
    read: draft.read,
    action: draft.action,
  }));
}

export function hasOpenStep(steps: readonly OnboardingStep[]): boolean {
  return steps.some((step) => step.read && step.state !== "done");
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
