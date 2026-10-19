import { describe, expect, it } from "vitest";

import type { AgentSummary, BindingSet, Credential, Project } from "@/api/types";

import { hasOpenStep, onboardingStepsOf, type OnboardingFacts } from "./onboarding";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function credential(name: string, platform: string, ended = false): Credential {
  return {
    name,
    platform,
    revisions: [
      { id: `${name}-1`, revision: 1, metadata: null, created_at: 1, ended_at: ended ? 2 : null },
    ],
  };
}

function agent(agentName: string, state: "enabled" | "disabled" | null): AgentSummary {
  return {
    agentName,
    workerNames: ["coder@1"],
    enablement:
      state === null
        ? null
        : {
            agent_name: agentName,
            state,
            agent_providers: [],
            default_configuration: {
              agent_provider: "router",
              model_identifier: "qwen",
              reasoning_effort: "off",
            },
            fallback_configurations: [],
            revision: 1,
          },
  };
}

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
  },
};

const EMPTY: OnboardingFacts = {
  llmCredentials: [],
  agents: [agent("re@1", null), agent("swe@1", null)],
  repositoryCredentials: [],
  projects: [],
};

const FULL: OnboardingFacts = {
  llmCredentials: [credential("router-main", "openrouter")],
  agents: [agent("re@1", "enabled"), agent("swe@1", "enabled")],
  repositoryCredentials: [credential("atlas-ssh", "ssh")],
  projects: [{ project: PROJECT, bindingSet: FULL_SET }],
};

function statesOf(facts: OnboardingFacts): readonly string[] {
  return onboardingStepsOf(facts).map((step) => `${step.key}:${step.state}`);
}

describe("onboardingStepsOf", () => {
  it("orders the steps and marks the first open step as next", () => {
    expect(statesOf(EMPTY)).toEqual([
      "llm_credential:next",
      "agents:open",
      "ssh_key:open",
      "project:open",
      "repository_binding:open",
      "worker_bindings:open",
    ]);
    expect(hasOpenStep(onboardingStepsOf(EMPTY))).toBe(true);
  });

  it("marks every step done on a set-up instance", () => {
    expect(statesOf(FULL)).toEqual([
      "llm_credential:done",
      "agents:done",
      "ssh_key:done",
      "project:done",
      "repository_binding:done",
      "worker_bindings:done",
    ]);
    expect(hasOpenStep(onboardingStepsOf(FULL))).toBe(false);
  });

  it("moves next to the first step that is still open", () => {
    expect(
      statesOf({ ...EMPTY, llmCredentials: FULL.llmCredentials, agents: FULL.agents }),
    ).toEqual([
      "llm_credential:done",
      "agents:done",
      "ssh_key:next",
      "project:open",
      "repository_binding:open",
      "worker_bindings:open",
    ]);
  });

  it("does not count an archived credential", () => {
    const steps = onboardingStepsOf({
      ...FULL,
      llmCredentials: [credential("old", "openrouter", true)],
      repositoryCredentials: [credential("old-ssh", "ssh", true), credential("gh", "github")],
    });

    expect(steps.find((step) => step.key === "llm_credential")?.state).toBe("next");
    expect(steps.find((step) => step.key === "ssh_key")?.state).toBe("open");
  });

  it("counts the enabled agents only", () => {
    const steps = onboardingStepsOf({
      ...FULL,
      agents: [agent("re@1", "disabled"), agent("swe@1", null)],
    });

    expect(steps.find((step) => step.key === "agents")).toMatchObject({
      state: "next",
      action: { label: "Enable re@1", path: "/agents/re%401#enablement", returns: true },
    });
  });

  it("keeps a step open when its read failed", () => {
    expect(
      statesOf({ llmCredentials: null, agents: null, repositoryCredentials: null, projects: null }),
    ).toEqual([
      "llm_credential:next",
      "agents:open",
      "ssh_key:open",
      "project:open",
      "repository_binding:open",
      "worker_bindings:open",
    ]);
  });

  it("opens the bindings of the first project that lacks the binding", () => {
    const second = { ...PROJECT, id: "prj-2", name: "atlas" };
    const steps = onboardingStepsOf({
      ...FULL,
      projects: [
        { project: PROJECT, bindingSet: { version: 1, bindings: {} } },
        { project: second, bindingSet: { version: 1, bindings: {} } },
      ],
    });

    expect(steps.find((step) => step.key === "repository_binding")?.action).toEqual({
      label: "Open bindings",
      path: "/projects/prj-1?tab=bindings",
      returns: true,
    });
  });

  it("points the binding steps at the project form while no project exists", () => {
    const steps = onboardingStepsOf(EMPTY);

    expect(steps.find((step) => step.key === "worker_bindings")?.action).toEqual({
      label: "New project",
      path: "/projects/new",
      returns: true,
    });
  });

  it("opens the SSH credential list without a return", () => {
    expect(onboardingStepsOf(EMPTY).find((step) => step.key === "ssh_key")?.action).toEqual({
      label: "Open repositories",
      path: "/repositories",
      returns: false,
    });
  });
});
