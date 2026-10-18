import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type {
  BindingSet,
  BindingSetEntry,
  ProjectBindingRecord,
  WorkerCatalogEntry,
} from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";

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
  config: { worker: "coder@1", instance_count: 2 },
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

async function chooseWorker(worker: string) {
  const input = screen.getByRole("combobox", { name: "Worker" });
  await userEvent.click(input);
  await userEvent.click(await screen.findByRole("option", { name: worker }));
}

async function agentItem(agent: string) {
  const list = await screen.findByRole("list", { name: "Agents" });
  const item = within(list)
    .getAllByRole("listitem")
    .find((candidate) => within(candidate).queryByText(agent) !== null);
  expect(item).toBeDefined();
  return item!;
}

function mount() {
  return render(
    <MemoryRouter>
      <BindingsPanel projectId="project_1" onWritten={onWritten} />
    </MemoryRouter>,
  );
}

describe("BindingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue(SET);
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [
        {
          name: "github-ssh",
          platform: "ssh",
          revisions: [
            {
              id: "rev_ssh",
              revision: 1,
              metadata: {
                host: "github.com",
                hostname: "github.com",
                port: 22,
                identity_file: "/home/user/.ssh/id_ed25519",
              },
              created_at: 1,
              ended_at: null,
            },
          ],
        },
        {
          name: "github-main",
          platform: "github",
          revisions: [{ id: "rev_1", revision: 1, metadata: null, created_at: 1, ended_at: null }],
        },
        { name: "github-kanthorlabs", platform: "github", revisions: [] },
      ],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
      items: [
        {
          platform: "ssh",
          secret_shape: "none",
          login_modes: [],
          metadata_fields: ["host", "hostname", "identity_file"],
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
    vi.mocked(projectsApi.listBindings).mockResolvedValue([BINDING_REPO, BINDING_WORKER]);
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
      address: { status: "healthy", capability: "network git read" },
      ssh_credential: { status: "healthy", capability: "ssh credential verify" },
      credential: { status: "healthy", capability: "repository credential verify" },
    });
    vi.mocked(projectsApi.checkBinding).mockResolvedValue({
      address: { status: "healthy", capability: "network git read" },
      ssh_credential: { status: "healthy", capability: "ssh credential verify" },
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
    const count = screen.getByLabelText("Instance count");
    await userEvent.clear(count);
    await userEvent.type(count, "0");
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

  it("writes the placement that the human chooses for a new worker binding", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    expect(screen.queryByRole("combobox", { name: "Placement" })).toBeNull();
    await userEvent.type(screen.getByLabelText("Name"), "coder-main");
    await chooseWorker("coder@1");
    await userEvent.click(await screen.findByRole("combobox", { name: "Placement" }));
    await userEvent.click(await screen.findByRole("option", { name: "server" }));
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
    await chooseWorker("harness@1");

    expect(await screen.findByText(/The harness of this worker selects/)).toBeTruthy();
    expect(screen.queryByLabelText("Placement")).toBeNull();
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
    expect(within(re).getByRole("link", { name: "agent page" })).toHaveAttribute(
      "href",
      "/agents/re%401",
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

  it("opens New credential, creates, selects it, and saves the binding", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      name: "github-new",
      platform: "github",
      revisions: [],
    });
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [
        {
          name: "github-ssh",
          platform: "ssh",
          revisions: [
            {
              id: "rev_ssh",
              revision: 1,
              metadata: {
                host: "github.com",
                hostname: "github.com",
                port: 22,
                identity_file: "/home/user/.ssh/id_ed25519",
              },
              created_at: 1,
              ended_at: null,
            },
          ],
        },
        {
          name: "github-main",
          platform: "github",
          revisions: [{ id: "rev_1", revision: 1, metadata: null, created_at: 1, ended_at: null }],
        },
        { name: "github-kanthorlabs", platform: "github", revisions: [] },
        { name: "github-new", platform: "github", revisions: [] },
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

    await userEvent.type(within(form).getByLabelText("Address"), "git@github.com:o/r.git");
    expect(within(form).getByText("Fill Name and SSH credential to verify and save.")).toBeTruthy();
    expect((verify as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not show Verify in the worker sheet", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
    const form = await screen.findByRole("form", { name: "Edit general-main" });
    expect(within(form).queryByRole("button", { name: "Verify" })).toBeNull();
  });
});
