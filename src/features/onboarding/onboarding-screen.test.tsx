import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type { AgentSummary, BindingSet, Credential, Project } from "@/api/types";
import { Button } from "@/components/ui/button";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/features/overview/overview-screen", () => ({
  OverviewScreen: ({ onResume }: { onResume?: () => void }) => (
    <>
      <p>Overview body</p>
      {onResume !== undefined && <Button onClick={onResume}>Resume onboarding</Button>}
    </>
  ),
}));

import { OnboardingScreen } from "./onboarding-screen";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 2,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const ROUTER: Credential = {
  name: "router-main",
  platform: "openrouter",
  revisions: [{ id: "c-1", revision: 1, metadata: null, created_at: 1, ended_at: null }],
};

const SSH: Credential = { ...ROUTER, name: "atlas-ssh", platform: "ssh" };

const SWE: AgentSummary = {
  agentName: "swe@1",
  workerNames: ["coder@1"],
  enablement: {
    agent_name: "swe@1",
    state: "enabled",
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

function ReturnProbe() {
  const state: unknown = useLocation().state;
  return <p>Form state {JSON.stringify(state)}</p>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<OnboardingScreen />} />
        <Route path="/llm/new" element={<ReturnProbe />} />
        <Route path="/repositories" element={<ReturnProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function serveEmpty() {
  vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([]);
  vi.mocked(workersApi.listAgents).mockResolvedValue([{ ...SWE, enablement: null }]);
  vi.mocked(projectsApi.listProjects).mockResolvedValue([]);
}

function serveFull() {
  vi.mocked(credentialsApi.listAllCredentials).mockImplementation(async (component) =>
    component === "llm" ? [ROUTER] : [SSH],
  );
  vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
  vi.mocked(projectsApi.listProjects).mockResolvedValue([PROJECT]);
  vi.mocked(projectsApi.readBindingSet).mockResolvedValue(FULL_SET);
}

function stepOf(title: string): HTMLElement {
  return screen.getByRole("listitem", { name: title });
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the setup steps of a fresh install with the LLM credential next", async () => {
    serveEmpty();
    mount();

    expect(await screen.findByRole("heading", { name: "Onboarding" })).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: "Setup steps" })).getAllByRole(
      "listitem",
    );
    expect(steps.map((step) => step.getAttribute("aria-label"))).toEqual([
      "LLM credential",
      "Enabled agents",
      "SSH key",
      "Project",
      "Repository binding",
      "Worker bindings",
    ]);
    expect(within(stepOf("LLM credential")).getByText("Next")).toBeTruthy();
    expect(within(stepOf("SSH key")).getByText("Open")).toBeTruthy();
    expect(screen.queryByText("Overview body")).toBeNull();
  });

  it("opens the LLM form with the return path of Onboarding", async () => {
    serveEmpty();
    mount();

    await userEvent.click(
      within(await screen.findByRole("listitem", { name: "LLM credential" })).getByRole("button", {
        name: "New LLM credential",
      }),
    );

    expect(screen.getByText('Form state {"return_to":"/"}')).toBeTruthy();
  });

  it("opens the SSH credential list without a return path", async () => {
    serveEmpty();
    mount();

    await userEvent.click(
      within(await screen.findByRole("listitem", { name: "SSH key" })).getByRole("button", {
        name: "Open repositories",
      }),
    );

    expect(screen.getByText("Form state null")).toBeTruthy();
  });

  it("marks a step done", async () => {
    serveEmpty();
    vi.mocked(credentialsApi.listAllCredentials).mockImplementation(async (component) =>
      component === "llm" ? [ROUTER] : [],
    );
    mount();

    expect(
      within(await screen.findByRole("listitem", { name: "LLM credential" })).getByText("Done"),
    ).toBeTruthy();
    expect(within(stepOf("Enabled agents")).getByText("Next")).toBeTruthy();
  });

  it("skips to Overview and resumes Onboarding from it", async () => {
    serveEmpty();
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Skip onboarding" }));

    expect(screen.getByText("Overview body")).toBeTruthy();
    expect(window.localStorage.getItem("kanthord.onboarding.skipped")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Resume onboarding" }));

    expect(screen.getByRole("heading", { name: "Onboarding" })).toBeTruthy();
    expect(window.localStorage.getItem("kanthord.onboarding.skipped")).toBeNull();
  });

  it("shows Overview without the resume link when every step is done", async () => {
    serveFull();
    mount();

    expect(await screen.findByText("Overview body")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume onboarding" })).toBeNull();
  });

  it("names a failed read and keeps the other steps", async () => {
    serveFull();
    vi.mocked(workersApi.listAgents).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    mount();

    expect(await screen.findByRole("heading", { name: "Onboarding" })).toBeTruthy();
    expect(screen.getByText(/agents \(The daemon did not answer\.\)/)).toBeTruthy();
    expect(within(stepOf("LLM credential")).getByText("Done")).toBeTruthy();
    expect(within(stepOf("Enabled agents")).getByText("Next")).toBeTruthy();
    expect(within(stepOf("Worker bindings")).getByText("Done")).toBeTruthy();
  });
});
