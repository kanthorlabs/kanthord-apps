import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type * as Sonner from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as instancesApi from "@/api/resources/worker-instances";
import * as workersApi from "@/api/resources/workers";
import type {
  BindingSet,
  BindingSetEntry,
  Credential,
  EnvironmentState,
  PlacementStatus,
  Project,
  ProjectBindingRecord,
  WorkerCatalogEntry,
  WorkerInstanceDetail,
  WorkerInstanceListItem,
} from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/worker-instances");
vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";

import { failureReasonHint } from "@/lib/failure-reason";
import { BindingsPanel } from "./bindings-panel";
import { textContent } from "../../../../../test/text-content";

const REPO: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: { base_branch: "main" },
    ssh_credential: "github-ssh",
    credential: "github-main",
    working_layer: {
      agents_md: true,
      agents_local_md: true,
      claude_md: true,
      claude_local_md: true,
      project_prompt: true,
    },
  },
};
const WORKER: BindingSetEntry = {
  kind: "worker",
  config: { worker: "coder@1", placement: "worker", worker_instances: ["mac-studio"] },
};

const SET: BindingSet = { version: 2, bindings: { "kanthord-repo": REPO, "general-main": WORKER } };

const BINDING_REPO: ProjectBindingRecord = {
  id: "binding_REPO1",
  project_id: "project_1",
  name: "kanthord-repo",
  kind: "repository",
  resource_identity: "repository:github:kanthorlabs/kanthord",
  revision: 1,
  config: REPO.config,
  created_at: 1,
  removed_at: null,
};

const BINDING_WORKER: ProjectBindingRecord = {
  id: "binding_WORK1",
  project_id: "project_1",
  name: "general-main",
  kind: "worker",
  resource_identity: "worker:kanthord:general-main",
  revision: 1,
  config: WORKER.config,
  created_at: 1,
  removed_at: null,
};

const CATALOG_ITEM = {
  host: "kanthord",
  declared_node_states: ["Available"],
  declared_intents: ["implement", "examine"],
} as const;

const CATALOG_ENTRIES: Readonly<Record<string, WorkerCatalogEntry>> = {
  "coder@1": {
    ...CATALOG_ITEM,
    name: "coder@1",
    method: "steps",
    agent_names: ["swe@1"],
    resource_budget: { turns: 200, wall_time_ms: 7200000 },
  },
  "reviewer@1": {
    ...CATALOG_ITEM,
    name: "reviewer@1",
    method: "evaluation",
    agent_names: ["re@1"],
    resource_budget: { turns: 200, wall_time_ms: 7200000 },
  },
};

const onWritten = vi.fn();
const onEnvironmentChanged = vi.fn();

function placementList(container: Partial<PlacementStatus>): readonly PlacementStatus[] {
  const open = { available: true, reason: null, detail: null, container_runtime: null } as const;
  return [
    { ...open, placement: "server" },
    {
      ...open,
      placement: "container",
      container_runtime: "podman",
      ...container,
    },
    { ...open, placement: "worker" },
  ];
}

const AVAILABLE_PLACEMENTS = placementList({});
const IN_CONTAINER = placementList({
  available: false,
  reason: "server_in_container",
  container_runtime: null,
});

async function chooseWorker(worker: string) {
  const input = screen.getByRole("combobox", { name: "Worker" });
  await userEvent.click(input);
  await userEvent.click(await screen.findByRole("option", { name: worker }));
}

async function chooseWorkerPlacement() {
  await screen.findByRole("radio", { name: /^Server/ });
  await userEvent.click(screen.getByRole("button", { name: "Advanced settings" }));
  await userEvent.click(await screen.findByRole("switch", { name: "Worker placement" }));
}

async function agentItem(agent: string) {
  const list = await screen.findByRole("list", { name: "Agents" });
  const item = within(list)
    .getAllByRole("listitem")
    .find((candidate) => within(candidate).queryByText(agent) !== null);
  expect(item).toBeDefined();
  return item!;
}

function environmentOf(bindingName: string, status: EnvironmentState["status"]): EnvironmentState {
  return {
    binding_id: "binding_REPO1",
    binding_name: bindingName,
    resource_identity: "repository:github:kanthorlabs/kanthord",
    target: "image",
    source: "stored",
    status,
    digest: null,
    tag: null,
    run_started_at: null,
    step_started_at: null,
    reason: null,
    failure: null,
    checks: [],
    repairs: 0,
    repairing: false,
  };
}

function LocationProbe() {
  return <output aria-label="Location">{useLocation().search}</output>;
}

function mount(
  environments: readonly EnvironmentState[] | null = null,
  entry: string = "/projects/project_1",
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <BindingsPanel
        projectId="project_1"
        environments={environments}
        onWritten={onWritten}
        onEnvironmentChanged={onEnvironmentChanged}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function mountFromOnboarding() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/projects/project_1", state: { return_to: "/" } }]}>
      <Routes>
        <Route path="/" element={<p>Onboarding view</p>} />
        <Route
          path="/projects/:projectId"
          element={
            <BindingsPanel
              projectId="project_1"
              environments={null}
              onWritten={onWritten}
              onEnvironmentChanged={onEnvironmentChanged}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const GITHUB_SSH_KEY = {
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGithubSsh kanthord-github-ssh",
  fingerprint: "SHA256:SS5y+4FAdGZpIGkhURFS2VSlcK1tTrWmGk8Az16VdMs",
};

const GITHUB_HOST_KEY = {
  host: "github.com",
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl",
  fingerprint: "SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU",
  source: "github_meta" as const,
  created_at: 1,
};

const ROUTER_MAIN: Credential = {
  name: "router-main",
  platform: "openrouter",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [],
};

function instanceItem(name: string, connected: boolean): WorkerInstanceListItem {
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
    binding_count: 0,
    holder_mismatch: false,
  };
}

function instanceDetail(name: string, projectIds: readonly string[]): WorkerInstanceDetail {
  const { connection, ...record } = instanceItem(name, true);
  return {
    ...record,
    connection,
    bindings: projectIds.map((project_id) => ({ project_id, binding: "mac-main" })),
    registrations: [],
    credentials: [],
  };
}

const CODER_INSTANCES = [instanceItem("mac-studio", true), instanceItem("build-01", false)];
const INSTANCE_PROJECTS: Readonly<Record<string, readonly string[]>> = {
  "mac-studio": ["project_1"],
  "build-01": ["project_1", "project_2"],
};
const PROJECT_FIELDS = {
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/work",
};
const PROJECTS: readonly Project[] = [
  { ...PROJECT_FIELDS, id: "project_1", name: "kanthord" },
  { ...PROJECT_FIELDS, id: "project_2", name: "apps" },
];

describe("BindingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue(SET);
    vi.mocked(projectsApi.readBindingEnvironment).mockResolvedValue({
      source: "stored",
      commit: null,
      environment: { image: "node:24" },
      reason: null,
    });
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [
        {
          name: "github-ssh",
          platform: "ssh",
          holder: "server",
          sealed_to: null,
          sealed_current: true,
          revisions: [
            {
              id: "rev_ssh",
              revision: 1,
              metadata: GITHUB_SSH_KEY,
              created_at: 1,
              ended_at: null,
            },
          ],
        },
        {
          name: "github-main",
          platform: "github",
          holder: "server",
          sealed_to: null,
          sealed_current: true,
          revisions: [{ id: "rev_1", revision: 1, metadata: null, created_at: 1, ended_at: null }],
        },
        {
          name: "github-kanthorlabs",
          platform: "github",
          holder: "server",
          sealed_to: null,
          sealed_current: true,
          revisions: [],
        },
      ],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
      items: [
        {
          platform: "ssh",
          secret_shape: "ssh_key",
          login_modes: [],
          metadata_fields: [],
          verifiable: true,
        },
        {
          platform: "github",
          secret_shape: "api_key",
          login_modes: [],
          metadata_fields: [],
          verifiable: true,
        },
      ],
    });
    vi.mocked(credentialsApi.listHostKeys).mockResolvedValue([GITHUB_HOST_KEY]);
    vi.mocked(projectsApi.listBindings).mockResolvedValue([BINDING_REPO, BINDING_WORKER]);
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(AVAILABLE_PLACEMENTS);
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue(CODER_INSTANCES);
    vi.mocked(instancesApi.readWorkerInstance).mockImplementation(async (name) =>
      instanceDetail(name, INSTANCE_PROJECTS[name] ?? []),
    );
    vi.mocked(projectsApi.listProjects).mockResolvedValue(PROJECTS);
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([
      { ...CATALOG_ITEM, name: "coder@1" },
      { ...CATALOG_ITEM, name: "reviewer@1" },
    ]);
    vi.mocked(workersApi.readWorkerCatalogEntry).mockImplementation(async (name) => {
      const entry = CATALOG_ENTRIES[name];
      if (entry === undefined) throw new ApiError("not_found", "The worker is not supplied.", 404);
      return entry;
    });
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([
      {
        agent_name: "swe@1",
        state: "enabled",
        agent_providers: [{ name: "codex", provider: "openai-codex", credential: "codex-main" }],
        default_configuration: {
          agent_provider: "codex",
          model_identifier: "gpt-6-luna",
          reasoning_effort: "medium",
        },
        fallback_configurations: [],
        revision: 1,
      },
    ]);
    vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
      { model_identifier: "gpt-6-luna", reasoning_efforts: ["medium", "high"] },
      { model_identifier: "gpt-6-sol", reasoning_efforts: ["high"] },
    ]);
    vi.mocked(projectsApi.writeBindingSet).mockResolvedValue({
      project_id: "project_1",
      binding_set_version: 3,
      changes: [],
    });
    vi.mocked(projectsApi.verifyBinding).mockResolvedValue({
      address: { status: "healthy", capability: "network git read", failure_reason: null },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: {
        status: "healthy",
        capability: "repository credential verify",
        failure_reason: null,
      },
    });
    vi.mocked(projectsApi.checkBinding).mockResolvedValue({
      address: { status: "healthy", capability: "network git read", failure_reason: null },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: null,
    });
    vi.mocked(projectsApi.readInstructionFiles).mockResolvedValue({
      commit: "3f2a9c1d4e5b6a7988776655443322110fedcba9",
      read_at: Date.now(),
      files: [
        { source: "agents_md", path: "AGENTS.md", state: "present", reason: null, text: "# Rules" },
        {
          source: "agents_local_md",
          path: "AGENTS.local.md",
          state: "absent",
          reason: null,
          text: null,
        },
        {
          source: "claude_md",
          path: "CLAUDE.md",
          state: "present",
          reason: null,
          text: "# Claude",
        },
        {
          source: "claude_local_md",
          path: "CLAUDE.local.md",
          state: "absent",
          reason: null,
          text: null,
        },
      ],
    });
    vi.mocked(missionApi.readMission).mockResolvedValue({
      id: "mission_1",
      project_id: "project_1",
      version: 3,
    });
    vi.mocked(missionApi.exportMissionJson).mockResolvedValue({
      mission_id: "mission_1",
      mission_version: 3,
      entries: [
        {
          filename: "reset-email.md",
          id: "node_1",
          intent: "implement",
          name: "Add password reset",
          requirement: "r",
          criterion: "c",
          verifications: ["v"],
          bindings: ["kanthord-repo"],
        },
      ],
    });
  });

  it("lists the bindings by kind with their state as text", async () => {
    mount();

    const repositories = await screen.findByRole("list", { name: "Repositories" });
    expect(within(repositories).getByText("kanthord-repo")).toBeTruthy();
    expect(within(repositories).getByText("(v1)")).toBeTruthy();
    expect(within(repositories).getByText("available")).toBeTruthy();
    expect(
      within(screen.getByRole("list", { name: "Workers" })).getByText("general-main"),
    ).toBeTruthy();
    expect(screen.getByText("No storage binding.")).toBeTruthy();
  });

  it("writes a revision as the whole set at the read version without a guard", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const credential = screen.getByLabelText("GitHub credential");
    await userEvent.clear(credential);
    await userEvent.type(credential, "kanth");
    await userEvent.click(
      await screen.findByRole("option", { name: "github-kanthorlabs (github)" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": { ...REPO, config: { ...REPO.config, credential: "github-kanthorlabs" } },
      "general-main": WORKER,
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(onWritten).toHaveBeenCalledOnce());
  });

  it("guards a removal, names the nodes and offers to make it unavailable instead", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Remove kanthord-repo" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Removing kanthord-repo refuses every use of it");
    expect(await within(dialog).findByText("Add password reset")).toBeTruthy();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Make unavailable instead" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": { ...REPO, config: { ...REPO.config, available: false } },
      "general-main": WORKER,
    });
  });

  it("removes the binding when the human confirms the removal", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Remove kanthord-repo" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove binding" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "general-main": WORKER,
    });
  });

  it("guards a switch to unavailable and keeps the binding when the human declines", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "mac-studio · Connected", pressed: true }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Making general-main unavailable");

    await userEvent.click(within(dialog).getByRole("button", { name: "Keep available" }));

    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
  });

  it("keeps the placement of a server binding when the binding is edited", async () => {
    const server: BindingSetEntry = {
      kind: "worker",
      config: { worker: "coder@1", instance_count: 2, placement: "server" },
    };
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: { ...SET.bindings, "general-main": server },
    });
    mount();

    expect(await screen.findByText(/placement server · instance count 2/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Edit general-main" }));
    expect(await screen.findByLabelText("Placement")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Placement")).toHaveValue("server");
    const count = screen.getByLabelText("Instance count");
    await userEvent.clear(count);
    await userEvent.type(count, "3");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": REPO,
      "general-main": { kind: "worker", config: { ...server.config, instance_count: 3 } },
    });
  });

  it("shows no placement on the card of a worker of an external harness", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([
      { ...CATALOG_ITEM, host: "external-harness", name: "coder@1" },
    ]);
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: {
        ...SET.bindings,
        "general-main": { kind: "worker", config: { worker: "coder@1", instance_count: 2 } },
      },
    });
    mount();

    expect(await screen.findByText(/instance count 2/)).toBeTruthy();
    expect(screen.queryByText(/placement/)).toBeNull();
  });

  it("explains the permanent placement choice on create", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");

    expect(await screen.findByText("The binding keeps this choice.")).toBeTruthy();
    expect(
      screen.getByText("Built in. Runs each instance as a thread of the server."),
    ).toBeTruthy();
    expect(
      screen.getByText("Runs each instance in its own container on the server host with Podman."),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^Server/ })).toBeChecked();
    expect(screen.queryByRole("switch", { name: "Worker placement" })).toBeNull();
  });

  it("writes the placement that the human chooses for a new worker binding", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    expect(screen.queryByRole("radiogroup", { name: "Placement" })).toBeNull();
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");
    await userEvent.click(await screen.findByRole("radio", { name: /^Container/ }));
    await userEvent.click(screen.getByRole("radio", { name: /^Server/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        "coder-main": {
          kind: "worker",
          config: { worker: "coder@1", instance_count: 1, placement: "server" },
        },
      }),
    );
  });

  it("keeps Save off until the agents of a hosted worker load and then defaults to server", async () => {
    let finishEntry: (entry: WorkerCatalogEntry) => void = () => {};
    vi.mocked(workersApi.readWorkerCatalogEntry).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishEntry = resolve;
        }),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");

    expect(screen.getByRole("button", { name: "Save binding" })).toBeDisabled();
    expect(screen.getByText("Save waits for the agents of the worker.")).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Placement" })).toBeNull();
    finishEntry(CATALOG_ENTRIES["coder@1"]!);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save binding" })).not.toBeDisabled(),
    );
    expect(screen.getByRole("radio", { name: /^Server/ })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        "coder-main": {
          kind: "worker",
          config: { worker: "coder@1", instance_count: 1, placement: "server" },
        },
      }),
    );
  });

  it("keeps Save off after a failed agent read until Retry loads the agents", async () => {
    vi.mocked(workersApi.readWorkerCatalogEntry).mockRejectedValueOnce(
      new ApiError("unavailable", "The catalog does not answer.", 502),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");

    expect(await screen.findByText("The catalog does not answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save binding" })).toBeDisabled();
    expect(screen.getByText("Retry the agent list to save.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save binding" })).not.toBeDisabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        "coder-main": {
          kind: "worker",
          config: { worker: "coder@1", instance_count: 1, placement: "server" },
        },
      }),
    );
  });

  it("writes the placement worker when the human chooses it for a hosted worker", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");
    await chooseWorkerPlacement();

    expect(screen.queryByLabelText("Instance count")).toBeNull();
    expect(await screen.findByText("Instances")).toBeTruthy();
    expect(instancesApi.listWorkerInstances).toHaveBeenCalledWith("coder@1");
    await userEvent.click(
      await screen.findByRole("button", { name: "mac-studio · Connected", pressed: false }),
    );
    await userEvent.click(screen.getByRole("button", { name: "build-01 · Not connected" }));
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        "coder-main": {
          kind: "worker",
          config: {
            worker: "coder@1",
            placement: "worker",
            worker_instances: ["mac-studio", "build-01"],
          },
        },
      }),
    );
  });

  it("names the listed instances of a worker binding in its row", async () => {
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: {
        ...SET.bindings,
        "general-main": {
          kind: "worker",
          config: { ...WORKER.config, worker_instances: ["mac-studio", "build-01"] },
        },
      },
    });
    mount();

    expect(
      await screen.findByText(textContent(/placement worker · instances mac-studio, build-01 · /)),
    ).toBeTruthy();
    expect(screen.queryByText(/instance count/)).toBeNull();
  });

  it("links the worker page when the worker holds no live instance", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([]);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");
    await chooseWorkerPlacement();

    expect(
      await screen.findByText(textContent("No instances of coder@1. Add one on the worker page.")),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "worker page" })).toHaveAttribute(
      "href",
      "/workers/coder%401",
    );
  });

  it("loads the instances of a saved worker binding and names an instance of two projects", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));

    expect(
      await screen.findByRole("button", { name: "mac-studio · Connected", pressed: true }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "build-01 · Not connected" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText(/serves/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "build-01 · Not connected" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "build-01 serves kanthord and apps. A tool of either project can read its key and its workspaces.",
    );
    expect(instancesApi.readWorkerInstance).toHaveBeenCalledWith("build-01");
  });

  it("shows a failed read of the projects of the chosen instances with Retry", async () => {
    vi.mocked(instancesApi.readWorkerInstance).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The projects of the chosen instances were not read. The daemon did not answer.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.queryByText(/The projects of the chosen instances were not read/)).toBeNull(),
    );
  });

  it("marks a saved instance that the live list does not hold as Not found", async () => {
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: {
        ...SET.bindings,
        "general-main": {
          kind: "worker",
          config: { ...WORKER.config, worker_instances: ["mac-studio", "gone-01"] },
        },
      },
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));

    const gone = await screen.findByRole("button", { name: "gone-01 · Not found" });
    expect(gone).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));
    expect(
      await screen.findByText(
        "gone-01 is not a live instance of coder@1. Remove it, or add it on the worker page.",
      ),
    ).toBeTruthy();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
    await userEvent.click(gone);
    expect(screen.queryByRole("button", { name: "gone-01 · Not found" })).toBeNull();
  });

  it("requires the Environment choice of a container worker binding with two repositories", async () => {
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: { engine: REPO, web: REPO, "general-main": WORKER },
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");
    await userEvent.click(await screen.findByRole("radio", { name: /^Container/ }));

    const environment = await screen.findByRole("combobox", { name: "Environment" });
    expect(screen.getByText(/^Fill .*Environment/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save binding" })).toBeDisabled();
    await userEvent.click(environment);
    expect(await screen.findByRole("option", { name: "engine" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "web" })).toBeTruthy();
    await userEvent.click(screen.getByRole("option", { name: "web" }));
    expect(screen.getByRole("button", { name: "Save binding" })).toBeEnabled();
  });

  it("turns container off with the reason when the server runs in a container", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(IN_CONTAINER);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");

    expect(await screen.findByRole("radio", { name: /^Container/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("radio", { name: /^Server/ })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("radio", { name: /^Server/ })).toBeChecked();
    expect(
      screen.getByText(
        "Off. This server runs in a container, so it cannot start a container for each instance. Keep server.",
      ),
    ).toBeTruthy();
  });

  it("turns container off with the reason when the placement list read fails", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");

    expect(await screen.findByRole("radio", { name: /^Container/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("radio", { name: /^Server/ })).toBeChecked();
    expect(
      await screen.findByText("Off. The check of the server host failed. Open this sheet again."),
    ).toBeTruthy();
  });

  it("turns server and container off while Advanced sets the worker placement", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");
    await chooseWorkerPlacement();

    expect(screen.getByRole("radio", { name: /^Server/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: /^Container/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByText(
        "Advanced settings set the worker placement. Turn it off to choose server or container.",
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("switch", { name: "Worker placement" }));
    expect(screen.getByRole("radio", { name: /^Server/ })).toBeChecked();
    expect(screen.getByLabelText("Instance count")).toHaveValue("1");
  });

  it("keeps the optional settings behind Advanced settings", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");
    await screen.findByRole("radio", { name: /^Server/ });

    expect(screen.queryByLabelText("Turn budget")).toBeNull();
    expect(screen.queryByLabelText("Tags")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Advanced settings" }));
    expect(await screen.findByLabelText("Turn budget")).toBeTruthy();
    expect(screen.getByLabelText("Tags")).toBeTruthy();
  });

  it("names the other stable reasons of an unavailable container", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(
      placementList({ available: false, reason: "runtime_absent" }),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");

    expect(
      await screen.findByText(
        "Off. Install Podman or Docker on the server host, then open this sheet again.",
      ),
    ).toBeTruthy();
  });

  it("keeps container on and shows the detail of a failed runtime", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(
      placementList({
        available: false,
        reason: "runtime_failed",
        detail: "Cannot connect to Podman.",
        container_runtime: null,
      }),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");

    expect(
      await screen.findByText(
        "Runs each instance in its own container on the server host. Cannot connect to Podman. Fix the container runtime of the server user, then open this sheet again.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^Container/ })).not.toHaveAttribute("aria-disabled");
  });

  it("writes the placement container when the server can run containers", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "sandbox-main");
    await chooseWorker("coder@1");
    await userEvent.click(await screen.findByRole("radio", { name: /^Container/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        "sandbox-main": {
          kind: "worker",
          config: {
            worker: "coder@1",
            instance_count: 1,
            placement: "container",
            environment: "kanthord-repo",
          },
        },
      }),
    );
  });

  it("shows the refusal of an added container binding and keeps the draft", async () => {
    vi.mocked(projectsApi.writeBindingSet).mockRejectedValue(
      new ApiError(
        "conflict",
        "Daemon text.",
        409,
        "project.bindings.worker.placement_unavailable",
        { binding: "sandbox-main", placement: "container", reason: "runtime_rootful" },
      ),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "sandbox-main");
    await chooseWorker("coder@1");
    await userEvent.click(await screen.findByRole("radio", { name: /^Container/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(
      await screen.findByText(
        "The container placement is not available. The container runtime runs as root on this host. Use rootless Podman or rootless Docker.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("sandbox-main");
  });

  it("lets the human lower the count of a container binding while container is off", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(IN_CONTAINER);
    const container: BindingSetEntry = {
      kind: "worker",
      config: { worker: "coder@1", instance_count: 2, placement: "container" },
    };
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: { ...SET.bindings, "general-main": container },
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
    expect(await screen.findByLabelText("Placement")).toHaveValue("container");
    const count = screen.getByLabelText("Instance count");
    await userEvent.clear(count);
    await userEvent.type(count, "0");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Make unavailable" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": REPO,
      "general-main": { kind: "worker", config: { ...container.config, instance_count: 0 } },
    });
    expect(workersApi.listWorkerPlacements).not.toHaveBeenCalled();
  });

  it("offers no placement for a worker of an external harness", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([
      { ...CATALOG_ITEM, name: "harness@1" },
    ]);
    vi.mocked(workersApi.readWorkerCatalogEntry).mockResolvedValue({
      ...CATALOG_ITEM,
      host: "external-harness",
      name: "harness@1",
      harness: "custom",
      resource_budget: { turns: 200, wall_time_ms: 7200000 },
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "harness-main");
    await chooseWorker("harness@1");

    expect(await screen.findByText(/The harness of this worker selects/)).toBeTruthy();
    expect(screen.queryByLabelText("Placement")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        "harness-main": { kind: "worker", config: { worker: "harness@1", instance_count: 1 } },
      }),
    );
  });

  it("names the machine tokens in the name hint of a worker binding only", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    expect(
      screen.getByText("Unique in the project. Machine tokens name the binding by it."),
    ).toBeTruthy();
  });

  it("writes the tags of a worker binding one key per line", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
    expect(
      screen.getByText(
        "One tag per line, for example platform.macos. Use lower-case dotted tags, each at most 64 bytes, each once. A node runs only on a binding whose tags include every tag of the node.",
      ),
    ).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Tags"), "platform.macos{enter}gpu.cuda");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": REPO,
      "general-main": {
        ...WORKER,
        config: { ...WORKER.config, tags: ["platform.macos", "gpu.cuda"] },
      },
    });
  });

  it("names Tags and keeps the save off for a repeated key", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
    expect(screen.getByLabelText("Tags")).toHaveAttribute("aria-invalid", "false");
    await userEvent.type(screen.getByLabelText("Tags"), "platform.macos{enter}platform.macos");

    expect(screen.getByLabelText("Tags")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Fill Tags to save.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save binding" })).toBeDisabled();
  });

  it("shows the tags of a worker binding as badges in its row", async () => {
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: {
        ...SET.bindings,
        "general-main": {
          kind: "worker",
          config: { worker: "coder@1", instance_count: 2, tags: ["platform.macos"] },
        },
      },
    });
    mount();

    const tags = await screen.findByRole("list", { name: "Tags of general-main" });
    expect(within(tags).getByText("platform.macos")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Tags of kanthord-repo" })).toBeNull();
  });

  it("counts the turns of the budget of a worker binding in the singular", async () => {
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      ...SET,
      bindings: {
        ...SET.bindings,
        "general-main": {
          kind: "worker",
          config: {
            worker: "coder@1",
            instance_count: 2,
            resource_budget: { turns: 1, wall_time_ms: 1000 },
          },
        },
      },
    });
    mount();

    const row = (await screen.findByRole("button", { name: "Edit general-main" })).closest(
      "[role=listitem]",
    ) as HTMLElement;
    expect(row).toHaveTextContent("budget 1 turn, 1000 ms");
  });

  it.each(["failed", "building"] as const)(
    "shows the badge Environment · %s in the row of a repository binding",
    async (status) => {
      mount([environmentOf("kanthord-repo", status), environmentOf("general-main", status)]);

      const row = (await screen.findByRole("button", { name: "Edit kanthord-repo" })).closest(
        "[role=listitem]",
      ) as HTMLElement;
      expect(within(row).getByText(`Environment · ${status}`)).toBeTruthy();
      const worker = screen
        .getByRole("button", { name: "Edit general-main" })
        .closest("[role=listitem]") as HTMLElement;
      expect(within(worker).queryByText(/^Environment/)).toBeNull();
    },
  );

  it("shows no Environment badge for the status none or for an absent state", async () => {
    mount([environmentOf("kanthord-repo", "none")]);

    await screen.findByRole("button", { name: "Edit kanthord-repo" });
    expect(screen.queryByText(/^Environment/)).toBeNull();
  });

  it("shows only the connection of a repository binding in its row", async () => {
    mount();

    const row = (await screen.findByRole("button", { name: "Edit kanthord-repo" })).closest(
      "[role=listitem]",
    ) as HTMLElement;
    expect(row).toHaveTextContent(
      "git@github.com:kanthorlabs/kanthord.git · github · ssh github-ssh · credential github-main",
    );
    expect(row).not.toHaveTextContent("base main");
  });

  it("separates the connection from the project policy in the repository form", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const connection = screen.getByRole("group", { name: "Repository" });
    const policy = screen.getByRole("group", { name: "Project policy" });
    expect(within(connection).getByLabelText("Address")).toBeTruthy();
    expect(within(connection).getByLabelText("SSH credential")).toBeTruthy();
    expect(within(connection).getByLabelText("GitHub credential")).toBeTruthy();
    expect(within(policy).getByLabelText("Base branch")).toBeTruthy();
    expect(within(policy).getByLabelText("External action")).toBeTruthy();
    expect(within(policy).queryByRole("list", { name: "Repository instructions" })).toBeNull();
    const instructions = screen.getByRole("group", { name: "Repository instructions" });
    expect(screen.queryByRole("group", { name: "Agent instructions" })).toBeNull();
    expect(await within(instructions).findByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(
      within(instructions).getByRole("list", { name: "Repository instructions" }),
    ).toBeTruthy();
  });

  it("reads the instruction files of the saved binding when its form opens", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));

    expect(await screen.findByRole("button", { name: "AGENTS.md" })).toBeTruthy();
    expect(projectsApi.readInstructionFiles).toHaveBeenCalledWith("project_1", "binding_REPO1");
  });

  it("keeps a switch that the human turns off in the written binding", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    await userEvent.click(await screen.findByRole("switch", { name: "CLAUDE.md switch" }));
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": {
        ...REPO,
        config: {
          ...REPO.config,
          working_layer: { ...REPO.config.working_layer, claude_md: false },
        },
      },
      "general-main": WORKER,
    });
  });

  it("explains the SSH credential and the GitHub credential next to their labels", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const connection = screen.getByRole("group", { name: "Repository" });
    expect(within(connection).getByRole("button", { name: "About SSH credential" })).toBeTruthy();
    await userEvent.click(
      within(connection).getByRole("button", { name: "About GitHub credential" }),
    );

    expect(await screen.findByText(/Git over SSH cannot call the GitHub API/)).toBeTruthy();
  });

  it("keeps the draft and does not resend after a version conflict", async () => {
    vi.mocked(projectsApi.writeBindingSet).mockRejectedValue(
      new ApiError(
        "conflict",
        "The submitted binding-set version differs.",
        409,
        "project.binding_set.version_conflict",
      ),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const branch = screen.getByLabelText("Base branch");
    await userEvent.clear(branch);
    await userEvent.type(branch, "develop");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(await screen.findByText("The bindings changed.")).toBeTruthy();
    expect(screen.getByLabelText("Base branch")).toHaveValue("develop");
    expect(projectsApi.writeBindingSet).toHaveBeenCalledOnce();
    expect(projectsApi.readBindingSet).toHaveBeenCalledTimes(2);
  });

  it("a node_unmatched refusal shows its message and keeps the draft", async () => {
    vi.mocked(projectsApi.writeBindingSet).mockRejectedValue(
      new ApiError(
        "conflict",
        "The binding set leaves a node and claimable state pair that no worker binding covers.",
        409,
        "project.bindings.worker.node_unmatched",
        { node_ids: ["node_mac"] },
      ),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const branch = screen.getByLabelText("Base branch");
    await userEvent.clear(branch);
    await userEvent.type(branch, "develop");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(
      await screen.findByText(
        "The change leaves a node with no matching worker binding. Keep a binding whose worker and tags match each listed node. Nodes: node_mac.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("The bindings changed.")).toBeNull();
    expect(screen.getByLabelText("Base branch")).toHaveValue("develop");
    expect(projectsApi.readBindingSet).toHaveBeenCalledOnce();
  });

  it("refuses a new binding whose name the project already uses", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "general-main");
    await chooseWorker("coder@1");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(screen.getByText("Another binding of this project uses this name.")).toBeTruthy();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
  });

  it("offers the released workers and lists the agents of the chosen worker", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    expect(screen.getByText("Choose a worker to see its agents.")).toBeTruthy();
    await userEvent.click(screen.getByRole("combobox", { name: "Worker" }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["coder@1", "reviewer@1"]);
    await userEvent.click(options[0]!);

    const swe = await agentItem("swe@1");
    expect(within(swe).getByText("Enabled")).toBeTruthy();
    expect(within(swe).getByText(textContent("Default: codex · gpt-6-luna · medium"))).toBeTruthy();
    await chooseWorker("reviewer@1");
    const re = await agentItem("re@1");
    expect(within(re).getByText("Not enabled")).toBeTruthy();
    expect(within(re).getByRole("button", { name: "Enable re@1" })).toBeTruthy();
  });

  it("enables a disabled agent in place after it reads the enablement again", async () => {
    const disabled = {
      agent_name: "re@1",
      state: "disabled" as const,
      agent_providers: [],
      default_configuration: {
        agent_provider: "router",
        model_identifier: "qwen/qwen3-coder",
        reasoning_effort: "medium" as const,
      },
      fallback_configurations: [],
      revision: 2,
    };
    vi.mocked(workersApi.listAgentEnablements)
      .mockResolvedValueOnce([disabled])
      .mockResolvedValue([{ ...disabled, state: "enabled", revision: 3 }]);
    vi.mocked(workersApi.readAgentEnablement).mockResolvedValue(disabled);
    vi.mocked(workersApi.enableAgentEnablement).mockResolvedValue({
      ...disabled,
      state: "enabled",
      revision: 3,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("reviewer@1");
    const re = await agentItem("re@1");

    expect(within(re).getByText("Disabled")).toBeTruthy();
    await userEvent.click(within(re).getByRole("button", { name: "Enable re@1" }));

    expect(workersApi.readAgentEnablement).toHaveBeenCalledWith("re@1");
    await waitFor(() => expect(workersApi.enableAgentEnablement).toHaveBeenCalledWith("re@1", 2));
    expect(screen.queryByRole("form", { name: "Enable re@1" })).toBeNull();
    expect(await within(await agentItem("re@1")).findByText("Enabled")).toBeTruthy();
  });

  it("disables an enabled agent in place only after a confirmation", async () => {
    const enabled = {
      agent_name: "re@1",
      state: "enabled" as const,
      agent_providers: [],
      default_configuration: {
        agent_provider: "router",
        model_identifier: "qwen/qwen3-coder",
        reasoning_effort: "medium" as const,
      },
      fallback_configurations: [],
      revision: 4,
    };
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([enabled]);
    vi.mocked(workersApi.readAgentEnablement).mockResolvedValue(enabled);
    vi.mocked(workersApi.disableAgentEnablement).mockResolvedValue({
      ...enabled,
      state: "disabled",
      revision: 5,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("reviewer@1");
    const re = await agentItem("re@1");
    await userEvent.click(within(re).getByRole("button", { name: "Disable re@1" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Disable re@1?" });
    expect(workersApi.disableAgentEnablement).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Disable agent" }));

    expect(workersApi.disableAgentEnablement).toHaveBeenCalledWith("re@1", 4);
  });

  it("focuses the nested enable sheet and closes only it on Escape", async () => {
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "reviewer");
    await chooseWorker("reviewer@1");
    const re = await agentItem("re@1");
    await userEvent.click(within(re).getByRole("button", { name: "Enable re@1" }));

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await waitFor(() => expect(within(form).getByLabelText("Agent provider name")).toHaveFocus());
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("form", { name: "Enable re@1" })).toBeNull());
    expect(screen.getByRole("button", { name: "Save binding" })).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("reviewer");
  });

  it("creates an LLM credential in a nested sheet and selects it in the enable form", async () => {
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([]);
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValue({
      status: "healthy",
      capability: "llm credential verify",
      failure_reason: null,
    } as never);
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
      items: [
        {
          platform: "openrouter",
          secret_shape: "api_key",
          login_modes: [],
          metadata_fields: [],
          verifiable: true,
        },
      ],
    });
    vi.mocked(credentialsApi.createCredential).mockImplementation(async () => {
      vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
      return ROUTER_MAIN;
    });
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["medium", "high"] },
    ]);
    mountFromOnboarding();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "reviewer");
    await chooseWorker("reviewer@1");
    const re = await agentItem("re@1");
    await userEvent.click(within(re).getByRole("button", { name: "Enable re@1" }));
    const enableForm = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(enableForm).getByLabelText("Agent provider name"), "router");
    expect(within(enableForm).queryByRole("link", { name: "Add an LLM credential" })).toBeNull();
    await userEvent.click(
      await within(enableForm).findByRole("button", { name: "New LLM credential" }),
    );

    const createForm = await screen.findByRole("form", { name: "New credential" });
    await userEvent.type(within(createForm).getByLabelText("Name"), "router-main");
    await userEvent.type(within(createForm).getByRole("combobox", { name: "Platform" }), "openr");
    await userEvent.click(await screen.findByRole("option", { name: "openrouter" }));
    await userEvent.type(within(createForm).getByLabelText("API Key"), "sk-or-secret");
    await userEvent.click(within(createForm).getByRole("button", { name: "Create credential" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "New credential" })).toBeNull());
    await waitFor(() =>
      expect(within(enableForm).getByRole("combobox", { name: "Model identifier" })).toHaveValue(
        "qwen/qwen3-coder",
      ),
    );
    expect(within(enableForm).getByRole("combobox", { name: "LLM credential" })).toHaveValue(
      "router-main (openrouter)",
    );
    expect(within(enableForm).getByLabelText("Agent provider name")).toHaveValue("router");
    expect(screen.queryByText("Onboarding view")).toBeNull();
    expect(screen.getByLabelText("Name")).toHaveValue("reviewer");
  });

  it("enables an agent in a nested sheet and keeps the draft of the binding", async () => {
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValue({
      status: "healthy",
      capability: "llm credential verify",
      failure_reason: null,
    } as never);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["medium", "high"] },
    ]);
    vi.mocked(workersApi.putAgentEnablement).mockImplementation(async (agentName, body) => {
      const enablement = {
        agent_name: agentName,
        state: "enabled" as const,
        agent_providers: body.agent_providers,
        default_configuration: body.default_configuration,
        fallback_configurations: [],
        revision: 1,
      };
      vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([enablement]);
      return enablement;
    });
    mountFromOnboarding();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "reviewer");
    await chooseWorker("reviewer@1");
    const count = screen.getByLabelText("Instance count");
    await userEvent.clear(count);
    await userEvent.type(count, "2");
    const re = await agentItem("re@1");
    await userEvent.click(within(re).getByRole("button", { name: "Enable re@1" }));

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    await userEvent.click(within(form).getByRole("combobox", { name: "LLM credential" }));
    await userEvent.click(await screen.findByRole("option", { name: "router-main (openrouter)" }));
    await waitFor(() =>
      expect(within(form).getByRole("combobox", { name: "Model identifier" })).toHaveValue(
        "qwen/qwen3-coder",
      ),
    );
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Enable re@1" })).toBeNull());
    expect(workersApi.putAgentEnablement).toHaveBeenCalledWith("re@1", {
      agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
      default_configuration: {
        agent_provider: "router",
        model_identifier: "qwen/qwen3-coder",
        reasoning_effort: "medium",
      },
      fallback_configurations: [],
    });
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
    expect(screen.queryByText("Onboarding view")).toBeNull();
    expect(within(await agentItem("re@1")).getByText("Enabled")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("reviewer");
    expect(screen.getByLabelText("Instance count")).toHaveValue("2");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        reviewer: {
          kind: "worker",
          config: { worker: "reviewer@1", instance_count: 2, placement: "server" },
        },
      }),
    );
  });

  it("writes the custom configuration of an agent in a new worker binding", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");
    const swe = await agentItem("swe@1");
    await userEvent.click(within(swe).getByRole("switch", { name: "Custom configuration" }));
    await userEvent.click(within(swe).getByRole("combobox", { name: "Model identifier" }));
    await userEvent.click(await screen.findByRole("option", { name: "gpt-6-sol" }));
    expect(workersApi.listAgentProviderModels).toHaveBeenCalledWith("swe@1", "codex");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
        "kanthord-repo": REPO,
        "general-main": WORKER,
        "coder-main": {
          kind: "worker",
          config: {
            worker: "coder@1",
            instance_count: 1,
            placement: "server",
            entries: [{ agent: "swe@1", model_identifier: "gpt-6-sol" }],
          },
        },
      }),
    );
  });

  it("offers a typed model identifier when the model list is unavailable", async () => {
    vi.mocked(workersApi.listAgentProviderModels).mockRejectedValue(
      new ApiError("unavailable", "The provider does not answer.", 502),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await chooseWorker("coder@1");
    const swe = await agentItem("swe@1");
    await userEvent.click(within(swe).getByRole("switch", { name: "Custom configuration" }));

    expect(
      await within(swe).findByText(
        textContent(
          "Optional. Empty keeps the default model. The model list of codex is unavailable: The provider does not answer.",
        ),
      ),
    ).toBeTruthy();
    expect(within(swe).getByRole("textbox", { name: "Model identifier" })).toBeTruthy();
  });

  it("refuses a custom configuration that changes no value", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");
    const swe = await agentItem("swe@1");
    await userEvent.click(within(swe).getByRole("switch", { name: "Custom configuration" }));
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(
      await screen.findByText(
        "Give a model identifier, a reasoning effort or both. To keep the defaults, turn off the custom configuration.",
      ),
    ).toBeTruthy();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
  });

  it("lists the agents of the worker of a saved binding", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));

    const swe = await agentItem("swe@1");
    expect(within(swe).getByText("Enabled")).toBeTruthy();
    expect(within(swe).getByRole("switch", { name: "Custom configuration" })).not.toBeChecked();
  });

  it("presses Verify on kanthord-repo and shows address and credential badges", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify kanthord-repo" }));

    expect(await screen.findByText("Address · Healthy")).toBeTruthy();
    expect(screen.getByText("SSH credential · Healthy")).toBeTruthy();
    expect(screen.getByText("GitHub credential · Healthy")).toBeTruthy();
    expect(projectsApi.verifyBinding).toHaveBeenCalledWith("project_1", "binding_REPO1");
  });

  it("shows an error toast when verify fails with an error code", async () => {
    vi.mocked(projectsApi.verifyBinding).mockRejectedValue(
      new ApiError("not_found", "Binding not found.", 404, "project.binding.not_found"),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify kanthord-repo" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Verifying binding failed.",
        expect.objectContaining({ description: "Binding not found." }),
      ),
    );
  });

  it("shows the hint of the failure reason when Verify finds an unhealthy address", async () => {
    vi.mocked(projectsApi.verifyBinding).mockResolvedValue({
      address: {
        status: "unhealthy",
        capability: "network git read",
        failure_reason: "host_key_unknown",
      },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify kanthord-repo" }));

    expect(await screen.findByText("Address · Unhealthy")).toBeTruthy();
    expect(screen.getByText(failureReasonHint("host_key_unknown", "repository"))).toBeTruthy();
  });

  it("announces the hint of the failure reason in the status region of the row", async () => {
    vi.mocked(projectsApi.verifyBinding).mockResolvedValue({
      address: {
        status: "unhealthy",
        capability: "network git read",
        failure_reason: "key_refused",
      },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify kanthord-repo" }));

    expect(await screen.findByText("Address · Unhealthy")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Verify hint of kanthord-repo" })).toHaveTextContent(
      failureReasonHint("key_refused", "repository"),
    );
  });

  it("removes the hint of an earlier unhealthy answer while a new Verify runs", async () => {
    vi.mocked(projectsApi.verifyBinding).mockResolvedValueOnce({
      address: {
        status: "unhealthy",
        capability: "network git read",
        failure_reason: "host_key_unknown",
      },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: null,
    });
    mount();

    const verify = await screen.findByRole("button", { name: "Verify kanthord-repo" });
    await userEvent.click(verify);
    expect(
      await screen.findByText(failureReasonHint("host_key_unknown", "repository")),
    ).toBeTruthy();

    vi.mocked(projectsApi.verifyBinding).mockReturnValueOnce(new Promise(() => {}));
    await userEvent.click(verify);

    expect(await screen.findByText("Address · Checking")).toBeTruthy();
    expect(screen.queryByText(failureReasonHint("host_key_unknown", "repository"))).toBeNull();
    expect(
      screen.getByRole("status", { name: "Verify hint of kanthord-repo" }),
    ).toBeEmptyDOMElement();
  });

  it("shows no hint when Verify finds a healthy address", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify kanthord-repo" }));

    expect(await screen.findByText("Address · Healthy")).toBeTruthy();
    expect(screen.queryByText(failureReasonHint("unclassified", "repository"))).toBeNull();
  });

  it("shows the hint of the failure reason when the sheet Verify finds an unhealthy address", async () => {
    vi.mocked(projectsApi.checkBinding).mockResolvedValue({
      address: {
        status: "unhealthy",
        capability: "network git read",
        failure_reason: "key_refused",
      },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const form = await screen.findByRole("form", { name: "Edit kanthord-repo" });
    await userEvent.click(within(form).getByRole("button", { name: "Verify" }));

    expect(await within(form).findByText(/Address · Unhealthy/)).toBeTruthy();
    expect(within(form).getByText(failureReasonHint("key_refused", "repository"))).toBeTruthy();
  });

  it("shows the hint of the failure reason when Save refuses an unreachable repository", async () => {
    vi.mocked(projectsApi.writeBindingSet).mockRejectedValue(
      new ApiError(
        "refused",
        "The repository SSH read failed.",
        422,
        "project.bindings.repository.ssh_unreachable",
        { failure_reason: "host_key_unknown" },
      ),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const branch = screen.getByLabelText("Base branch");
    await userEvent.clear(branch);
    await userEvent.type(branch, "develop");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(
      await screen.findByText(new RegExp(failureReasonHint("host_key_unknown", "repository"))),
    ).toBeTruthy();
    expect(screen.getByLabelText("Base branch")).toHaveValue("develop");
  });

  it("opens New credential, creates, selects it, and saves the binding", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      name: "github-new",
      platform: "github",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    });
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [
        {
          name: "github-ssh",
          platform: "ssh",
          holder: "server",
          sealed_to: null,
          sealed_current: true,
          revisions: [
            {
              id: "rev_ssh",
              revision: 1,
              metadata: GITHUB_SSH_KEY,
              created_at: 1,
              ended_at: null,
            },
          ],
        },
        {
          name: "github-main",
          platform: "github",
          holder: "server",
          sealed_to: null,
          sealed_current: true,
          revisions: [{ id: "rev_1", revision: 1, metadata: null, created_at: 1, ended_at: null }],
        },
        {
          name: "github-kanthorlabs",
          platform: "github",
          holder: "server",
          sealed_to: null,
          sealed_current: true,
          revisions: [],
        },
        {
          name: "github-new",
          platform: "github",
          holder: "server",
          sealed_to: null,
          sealed_current: true,
          revisions: [],
        },
      ],
      next_cursor: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const newCredentialButtons = await screen.findAllByRole("button", { name: "New credential" });
    await userEvent.click(newCredentialButtons[newCredentialButtons.length - 1] as HTMLElement);

    const createForm = await screen.findByRole("form", { name: "New credential" });
    await userEvent.type(within(createForm).getByLabelText("Name"), "github-new");
    await userEvent.type(within(createForm).getByLabelText("API Key"), "ghp-secret");
    await userEvent.click(within(createForm).getByRole("button", { name: "Create credential" }));

    await waitFor(() =>
      expect(credentialsApi.createCredential).toHaveBeenCalledWith("repository", {
        name: "github-new",
        platform: "github",
        metadata: null,
        secret: { key: "ghp-secret" },
      }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Save binding" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": { ...REPO, config: { ...REPO.config, credential: "github-new" } },
      "general-main": WORKER,
    });
  });

  it("opens the rotate sheet for the selected credential", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    await userEvent.click(await screen.findByRole("button", { name: "Rotate" }));

    expect(await screen.findByRole("form", { name: "Rotate github-main" })).toBeTruthy();
  });

  it("shows Verify in the repository sheet and shows badges after a successful check", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const form = await screen.findByRole("form", { name: "Edit kanthord-repo" });
    expect(within(form).getByRole("button", { name: "Verify" })).toBeTruthy();

    await userEvent.click(within(form).getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(screen.getByText(/Address · Healthy/)).toBeTruthy());
    expect(screen.getByText(/SSH credential · Healthy/)).toBeTruthy();
    expect(projectsApi.checkBinding).toHaveBeenCalledWith(
      "project_1",
      expect.objectContaining({ kind: "repository" }),
    );
  });

  it("keeps Verify and Save disabled until the required repository fields are filled", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add repositories binding" }));
    const form = await screen.findByRole("form");
    const verify = within(form).getByRole("button", { name: "Verify" });
    const save = within(form).getByRole("button", { name: "Save binding" });
    expect((verify as HTMLButtonElement).disabled).toBe(true);
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(form).getByText("Fill Name, Address and SSH credential to verify and save."),
    ).toBeTruthy();

    expect(within(form).getByLabelText("Address")).toHaveValue("git@github.com:");
    await userEvent.type(within(form).getByLabelText("Address"), "o/r.git");
    expect(within(form).getByText("Fill Name and SSH credential to verify and save.")).toBeTruthy();
    expect((verify as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not show Verify in the worker sheet", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
    const form = await screen.findByRole("form", { name: "Edit general-main" });
    expect(within(form).queryByRole("button", { name: "Verify" })).toBeNull();
  });
  it("shows the pinned host key of the address in the repository sheet", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const row = await screen.findByRole("group", { name: "Host key of github.com" });

    expect(await within(row).findByText("Pinned")).toBeTruthy();
    expect(within(row).getByText(GITHUB_HOST_KEY.fingerprint)).toBeTruthy();
    expect(credentialsApi.scanHostKey).not.toHaveBeenCalled();
  });

  it("keeps Save off until the human confirms the host key of a GitLab address", async () => {
    const scan = {
      host: "gitlab.com",
      public_key: "ssh-ed25519 AAAAgitlab",
      fingerprint: "SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8",
      source: "keyscan" as const,
    };
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(scan);
    vi.mocked(credentialsApi.pinHostKey).mockResolvedValue({ ...scan, created_at: 2 });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const form = await screen.findByRole("form", { name: "Edit kanthord-repo" });
    await userEvent.click(within(form).getByLabelText("Platform"));
    await userEvent.click(await screen.findByRole("option", { name: "GitLab" }));
    const address = within(form).getByLabelText("Address");
    await userEvent.clear(address);
    await userEvent.type(address, "git@gitlab.com:kanthorlabs/kanthord.git");

    const confirm = await within(form).findByRole("button", { name: "Confirm host key" });
    expect(within(form).getByRole("button", { name: "Save binding" })).toBeDisabled();
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(within(form).getByRole("button", { name: "Save binding" })).toBeEnabled(),
    );
    expect(credentialsApi.pinHostKey).toHaveBeenCalledWith("gitlab.com", {
      fingerprint: scan.fingerprint,
    });
  });

  it("refuses an alias host in the address before the save", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const address = await screen.findByLabelText("Address");
    await userEvent.clear(address);
    await userEvent.type(address, "git@github-work:kanthorlabs/kanthord.git");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(
      await screen.findByText("The host of a GitHub address must be github.com or ssh.github.com."),
    ).toBeTruthy();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
  });

  it("creates an SSH key from New SSH credential and selects it", async () => {
    const created: Credential = {
      name: "deploy-atlas",
      platform: "ssh",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [
        {
          id: "rev_new",
          revision: 1,
          metadata: {
            public_key: "ssh-ed25519 AAAAdeploy kanthord-deploy-atlas",
            fingerprint: "SHA256:ZGVwbG95LWF0bGFzLWZpbmdlcnByaW50LXZhbHVlLWhlcmU",
          },
          created_at: 2,
          ended_at: null,
        },
      ],
    };
    vi.mocked(credentialsApi.createSshKey).mockResolvedValue(created);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    await userEvent.click(await screen.findByRole("button", { name: "New SSH credential" }));
    const sheet = await screen.findByRole("form", { name: "Create SSH key" });
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [created],
      next_cursor: null,
    });
    await userEvent.type(within(sheet).getByLabelText("Name"), "deploy-atlas");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create SSH key" }));
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "SSH credential" })).toHaveValue(
        "deploy-atlas (v1)",
      ),
    );
  });

  it("keeps the binding sheet open after an SSH key create from onboarding", async () => {
    const created: Credential = {
      name: "deploy-atlas",
      platform: "ssh",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [
        {
          id: "rev_new",
          revision: 1,
          metadata: {
            public_key: "ssh-ed25519 AAAAdeploy kanthord-deploy-atlas",
            fingerprint: "SHA256:ZGVwbG95LWF0bGFzLWZpbmdlcnByaW50LXZhbHVlLWhlcmU",
          },
          created_at: 2,
          ended_at: null,
        },
      ],
    };
    vi.mocked(credentialsApi.createSshKey).mockResolvedValue(created);
    mountFromOnboarding();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    await userEvent.click(await screen.findByRole("button", { name: "New SSH credential" }));
    const sheet = await screen.findByRole("form", { name: "Create SSH key" });
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [created],
      next_cursor: null,
    });
    await userEvent.type(within(sheet).getByLabelText("Name"), "deploy-atlas");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create SSH key" }));
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "SSH credential" })).toHaveValue(
        "deploy-atlas (v1)",
      ),
    );
    expect(screen.queryByText("Onboarding view")).toBeNull();
  });

  it("shows the public key of the SSH credential when the host refuses the key", async () => {
    vi.mocked(projectsApi.checkBinding).mockResolvedValue({
      address: {
        status: "unhealthy",
        capability: "network git read",
        failure_reason: "key_refused",
      },
      ssh_credential: { status: "healthy", capability: "ssh identity", failure_reason: null },
      credential: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const form = await screen.findByRole("form", { name: "Edit kanthord-repo" });
    await userEvent.click(within(form).getByRole("button", { name: "Verify" }));

    expect(await within(form).findByText(GITHUB_SSH_KEY.public_key)).toBeTruthy();
    expect(within(form).getByRole("button", { name: "Copy public key" })).toBeTruthy();
  });

  it("shows the hint of an unavailable SSH identity on the row and in the sheet", async () => {
    const unavailable = {
      address: { status: "healthy" as const, capability: "network git read", failure_reason: null },
      ssh_credential: {
        status: "unhealthy" as const,
        capability: "ssh identity",
        failure_reason: "identity_unavailable" as const,
      },
      credential: null,
    };
    vi.mocked(projectsApi.verifyBinding).mockResolvedValue(unavailable);
    vi.mocked(projectsApi.checkBinding).mockResolvedValue(unavailable);
    const hint = failureReasonHint("identity_unavailable", "repository");
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify kanthord-repo" }));
    const status = await screen.findByRole("status", { name: "Verify hint of kanthord-repo" });
    expect(await within(status).findByText(hint)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Edit kanthord-repo" }));
    const form = await screen.findByRole("form", { name: "Edit kanthord-repo" });
    await userEvent.click(within(form).getByRole("button", { name: "Verify" }));
    expect(await within(form).findByText(hint)).toBeTruthy();
  });
  it("names the unpinned host when the save refuses the binding", async () => {
    vi.mocked(projectsApi.writeBindingSet).mockRejectedValue(
      new ApiError(
        "conflict",
        "The SSH host holds no pinned host key.",
        409,
        "repository.host_key.unpinned",
        { host: "github.com" },
      ),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const branch = screen.getByLabelText("Base branch");
    await userEvent.clear(branch);
    await userEvent.type(branch, "develop");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(
      await screen.findByText(
        "The server holds no host key for github.com. Pin the host key, then try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Base branch")).toHaveValue("develop");
  });

  describe("environment section", () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;

    beforeEach(() => {
      Element.prototype.scrollIntoView = scrollIntoView;
    });

    afterEach(() => {
      Element.prototype.scrollIntoView = original;
    });

    const READY: EnvironmentState = {
      ...environmentOf("kanthord-repo", "ready"),
      digest: "sha256:0123456789abcdef0123",
      checks: [{ command: "pnpm test", exit_code: 1 }],
    };
    const FAILED: EnvironmentState = {
      ...environmentOf("kanthord-repo", "failed"),
      failure: {
        class: "command_absent",
        origin: "onboarding",
        execution_id: null,
        command: "pnpm",
        exit_code: 127,
        tail: "pnpm: command not found",
        reproduce: "docker run --rm node:24 pnpm test",
        ended_at: 1,
      },
    };

    it("shows the facts and the red baseline of a ready state", async () => {
      mount([READY]);

      await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
      const region = await screen.findByRole("region", { name: "Environment" });

      expect(within(region).getByText("Source")).toBeTruthy();
      expect(within(region).getByText("Target")).toBeTruthy();
      expect(within(region).getByText("Digest")).toBeTruthy();
      expect(within(region).getByText("sha256:01234")).toBeTruthy();
      expect(within(region).getByText("Red baseline")).toBeTruthy();
      expect(within(region).getByText("pnpm test · exit 1")).toBeTruthy();
      expect(within(region).queryByText("command_absent")).toBeNull();
    });

    it("shows the failure with two copy buttons", async () => {
      mount([FAILED]);

      await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
      const region = await screen.findByRole("region", { name: "Environment" });

      expect(within(region).getByText("command_absent")).toBeTruthy();
      expect(within(region).getByText("pnpm")).toBeTruthy();
      expect(within(region).getByText("exit 127")).toBeTruthy();
      expect(within(region).getByText("pnpm: command not found")).toBeTruthy();
      expect(within(region).getByText("docker run --rm node:24 pnpm test")).toBeTruthy();
      expect(within(region).getByRole("button", { name: "Copy tail" })).toBeTruthy();
      expect(within(region).getByRole("button", { name: "Copy reproduce command" })).toBeTruthy();
    });

    it("runs the onboarding again and reports the change", async () => {
      vi.mocked(projectsApi.rebuildEnvironment).mockResolvedValue(READY);
      mount([READY]);

      await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
      await userEvent.click(await screen.findByRole("button", { name: "Run onboarding again" }));

      await waitFor(() => expect(onEnvironmentChanged).toHaveBeenCalledTimes(1));
      expect(projectsApi.rebuildEnvironment).toHaveBeenCalledWith("project_1", "binding_REPO1");
      expect(toast.success).toHaveBeenCalledWith("Onboarding of kanthord-repo started.");
    });

    it("holds no section in the sheet of a new repository binding", async () => {
      mount([READY]);

      await userEvent.click(
        await screen.findByRole("button", { name: "Add repositories binding" }),
      );
      await screen.findByRole("form", { name: "Add repository binding" });

      expect(screen.queryByRole("region", { name: "Environment" })).toBeNull();
    });

    it("holds no section in the sheet of a worker binding", async () => {
      mount([READY]);

      await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
      await screen.findByRole("form", { name: "Edit general-main" });

      expect(screen.queryByRole("region", { name: "Environment" })).toBeNull();
    });

    it("opens the sheet at the section from the path parameter and removes it on close", async () => {
      vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
        version: 2,
        bindings: { engine: REPO },
      });
      vi.mocked(projectsApi.listBindings).mockResolvedValue([{ ...BINDING_REPO, name: "engine" }]);
      mount(null, "/projects/project_1?tab=bindings&environment=engine");

      const form = await screen.findByRole("form", { name: "Edit engine" });
      await within(form).findByRole("region", { name: "Environment" });
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

      await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("form", { name: "Edit engine" })).toBeNull());
      expect(screen.getByLabelText("Location")).toHaveTextContent("?tab=bindings");
      expect(screen.getByLabelText("Location")).not.toHaveTextContent("environment");
    });

    describe("edit environment", () => {
      async function openEditor() {
        mount([READY]);
        await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
        await userEvent.click(await screen.findByRole("button", { name: "Edit environment" }));
        return screen.findByRole("textbox", { name: "Environment" });
      }

      it("opens the sheet with the stored environment as indented JSON", async () => {
        const field = await openEditor();

        expect(field).toHaveValue(JSON.stringify({ image: "node:24" }, null, 2));
        expect(screen.getByRole("heading", { name: "Edit environment" })).toBeTruthy();
      });

      it("keeps Edit environment off and shows the failure when the read fails", async () => {
        vi.mocked(projectsApi.readBindingEnvironment).mockRejectedValue(
          new ApiError("unavailable", "The daemon is down.", 503, "other"),
        );
        mount([READY]);
        await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));

        expect(await screen.findByText("The stored environment was not read")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Edit environment" })).toBeDisabled();
        expect(screen.queryByRole("textbox", { name: "Environment" })).toBeNull();
      });

      it("refuses a text that is not one JSON object", async () => {
        const field = await openEditor();

        await userEvent.clear(field);
        await userEvent.type(field, "[[]");
        await userEvent.click(screen.getByRole("button", { name: "Save environment" }));

        expect(
          await screen.findByText(
            "The environment is not a JSON object. Remove the comments and the trailing commas.",
          ),
        ).toBeTruthy();
        expect(projectsApi.writeBindingEnvironment).not.toHaveBeenCalled();
      });

      it("shows a refusal of the server under the field", async () => {
        vi.mocked(projectsApi.writeBindingEnvironment).mockRejectedValue(
          new ApiError(
            "refused",
            "The environment key runArgs is refused: the key is not allowed.",
            400,
            "project.environment.key_refused",
          ),
        );
        await openEditor();

        await userEvent.click(screen.getByRole("button", { name: "Save environment" }));

        expect(
          await screen.findByText(
            "The environment key runArgs is refused: the key is not allowed.",
          ),
        ).toBeTruthy();
        expect(screen.getByRole("textbox", { name: "Environment" })).toBeTruthy();
      });

      it("saves the binding with the saved environment", async () => {
        vi.mocked(projectsApi.writeBindingEnvironment).mockResolvedValue({
          project_id: "project_1",
          binding_set_version: 3,
          changes: [],
        });
        const field = await openEditor();

        await userEvent.clear(field);
        await userEvent.click(field);
        await userEvent.paste('{"image":"saved"}');
        await userEvent.click(screen.getByRole("button", { name: "Save environment" }));
        await waitFor(() =>
          expect(projectsApi.writeBindingEnvironment).toHaveBeenCalledWith(
            "project_1",
            "binding_REPO1",
            { image: "saved" },
          ),
        );
        await waitFor(() =>
          expect(screen.queryByRole("textbox", { name: "Environment" })).toBeNull(),
        );
        await userEvent.click(await screen.findByRole("button", { name: "Save binding" }));

        await waitFor(() => expect(projectsApi.writeBindingSet).toHaveBeenCalled());
        const bindings = vi.mocked(projectsApi.writeBindingSet).mock.calls[0]?.[2];
        expect(bindings?.["kanthord-repo"]).toMatchObject({
          config: { environment: { image: "saved" } },
        });
      });
    });

    it("opens nothing for a name that is no repository entry", async () => {
      mount(null, "/projects/project_1?tab=bindings&environment=general-main");

      await screen.findByRole("button", { name: "Edit general-main" });

      expect(screen.queryByRole("form")).toBeNull();
    });
  });
});
