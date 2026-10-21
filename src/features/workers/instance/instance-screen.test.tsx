import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as clientApi from "@/api/client";
import * as credentialsApi from "@/api/resources/credentials";
import * as gatewayApi from "@/api/resources/gateway";
import * as instancesApi from "@/api/resources/worker-instances";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type {
  Credential,
  CredentialPlatformList,
  Project,
  WorkerInstanceDetail,
  WorkerInstanceListItem,
} from "@/api/types";

vi.mock("@/api/client", async (original) => ({
  ...(await original<typeof clientApi>()),
  connectionBaseUrl: vi.fn(),
}));
vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/gateway");
vi.mock("@/api/resources/worker-instances");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/scheduler");
vi.mock("@/api/resources/mission");

import { InstanceScreen } from "./instance-screen";

const FINGERPRINT = "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE";

const PROJECTS: Project[] = [
  {
    id: "prj-a",
    name: "kanthord",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/a",
  },
  {
    id: "prj-b",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/b",
  },
];

const MAC: WorkerInstanceDetail = {
  id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I01",
  name: "mac-studio",
  worker: "coder@1",
  revision: 1,
  public_key: "a".repeat(43),
  fingerprint: FINGERPRINT,
  created_at: 1,
  ended_at: null,
  connection: { connection_name: "mac-studio.local", connected_at: 1, last_heartbeat_at: 2 },
  bindings: [
    { project_id: "prj-a", binding: "mac-main" },
    { project_id: "prj-b", binding: "mac-main" },
  ],
  registrations: [],
  credentials: [
    { name: "atlas-router", revision: 1, platform: "openai-compatible", sealed_current: true },
    { name: "claude-sub", revision: 1, platform: "anthropic-subscription", sealed_current: true },
    { name: "old-key", revision: 3, platform: "anthropic", sealed_current: false },
  ],
};

const FREE: WorkerInstanceDetail = { ...MAC, bindings: [], credentials: [] };

const PLATFORMS: CredentialPlatformList = {
  items: [
    {
      platform: "anthropic",
      secret_shape: "api_key",
      login_modes: [],
      metadata_fields: [],
      verifiable: true,
    },
    {
      platform: "anthropic-subscription",
      secret_shape: "oauth",
      login_modes: ["browser", "copy_code"],
      metadata_fields: [],
      verifiable: false,
    },
    {
      platform: "openai-compatible",
      secret_shape: "api_key",
      login_modes: [],
      metadata_fields: ["base_url"],
      verifiable: true,
    },
  ],
};

const OTHERS: WorkerInstanceListItem[] = [
  { ...MAC, connection: null, binding_count: 1, holder_mismatch: false },
  {
    ...MAC,
    id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I04",
    name: "review-01",
    worker: "reviewer@1",
    connection: null,
    binding_count: 0,
    holder_mismatch: false,
  },
];

function copyOf(holder: string, revision: number): Credential {
  return {
    name: "old-key",
    platform: "anthropic",
    holder,
    sealed_to: null,
    sealed_current: true,
    revisions: [{ id: `r-${holder}`, revision, metadata: null, created_at: 1, ended_at: null }],
  };
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/workers/coder%401/instances/mac-studio"]}>
      <Routes>
        <Route path="/workers/:workerName/instances/:instanceName" element={<InstanceScreen />} />
        <Route path="/workers/:workerName" element={<p>Worker page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue(MAC);
  vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue(OTHERS);
  vi.mocked(projectsApi.listProjects).mockResolvedValue(PROJECTS);
  vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
  vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue(PLATFORMS);
  vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue([]);
  vi.mocked(gatewayApi.readServerVersion).mockResolvedValue("28.0.1");
  vi.mocked(clientApi.connectionBaseUrl).mockReturnValue("https://kd.example.com");
});

describe("InstanceScreen", () => {
  it("shows the header, the bindings in every project and the trust notice", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: "mac-studio" })).toBeInTheDocument();
    expect(screen.getByText(FINGERPRINT)).toBeInTheDocument();
    expect(screen.getByText(/Connected · mac-studio\.local · last heartbeat/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "mac-studio serves kanthord and atlas. A tool of either project can read its key and its workspaces.",
      ),
    );
    const bindings = screen.getByRole("list", { name: "Bindings" });
    expect(within(bindings).getAllByText("serving")).toHaveLength(2);
    expect(within(bindings).getAllByRole("link", { name: "Open binding" })[0]).toHaveAttribute(
      "href",
      "/projects/prj-a?tab=bindings",
    );
  });

  it("marks a copy sealed to an ended key and disables Sign in again with a reason", async () => {
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    expect(within(credentials).getByText("Re-enter: sealed to an ended key.")).toBeInTheDocument();
    expect(
      await within(credentials).findByRole("button", { name: "Sign in again" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(within(credentials).getAllByRole("button", { name: "Rotate" })).toHaveLength(2);
  });

  it("disables Archive while a binding lists the instance", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "Archive" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("archives a free instance and opens the worker page", async () => {
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue(FREE);
    vi.mocked(instancesApi.archiveWorkerInstance).mockResolvedValue({ ...FREE, ended_at: 9 });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive mac-studio" }));
    await waitFor(() =>
      expect(instancesApi.archiveWorkerInstance).toHaveBeenCalledWith("mac-studio", 1),
    );
    expect(await screen.findByText("Worker page")).toBeInTheDocument();
  });

  it("shows the bindings of an in_use refusal", async () => {
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue(FREE);
    vi.mocked(instancesApi.archiveWorkerInstance).mockRejectedValue(
      new ApiError(
        "conflict",
        "A binding lists the worker instance.",
        409,
        "worker.instance.in_use",
        {
          bindings: [{ project_id: "prj-b", binding: "mac-main" }],
        },
      ),
    );
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive mac-studio" }));
    expect(await within(dialog).findByText("Binding mac-main of atlas")).toBeInTheDocument();
  });

  it("resets the key with the blast radius and shows the new configuration once", async () => {
    vi.mocked(instancesApi.resetWorkerInstanceKey).mockResolvedValue({
      ...MAC,
      revision: 2,
      instance_configuration: "eyJuZXciOnRydWV9",
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Reset key" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        "Rotate each listed credential with a new secret, and rotate the key at the provider. The old configuration still opens these credentials.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("atlas-router, claude-sub, old-key")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reset key" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    await waitFor(() =>
      expect(instancesApi.resetWorkerInstanceKey).toHaveBeenCalledWith(
        "mac-studio",
        "https://kd.example.com",
        1,
      ),
    );
    expect(await within(dialog).findByText("eyJuZXciOnRydWV9")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Store the instance configuration as a secret/),
    ).toBeInTheDocument();
  });

  it("seals an API key copy to this instance and to each selected instance", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue(copyOf("mac-studio", 1));
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add credential" }));
    const sheet = await screen.findByRole("dialog", { name: "Add credential" });
    await userEvent.type(within(sheet).getByLabelText("Name"), "claude-key");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Platform" }));
    await userEvent.click(await screen.findByRole("option", { name: "anthropic" }));
    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-1");
    await userEvent.click(await within(sheet).findByRole("button", { name: "review-01" }));
    expect(within(sheet).queryByRole("button", { name: "mac-studio" })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Create credential" }));
    await waitFor(() =>
      expect(credentialsApi.createCredential).toHaveBeenCalledWith("llm", {
        name: "claude-key",
        platform: "anthropic",
        metadata: null,
        secret: { key: "sk-1" },
        holders: ["mac-studio", "review-01"],
      }),
    );
  });

  it("starts the sign-in of an OAuth platform on the instance in copy-code mode", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue({
      session_id: "login_session_1",
      address: "https://claude.ai/oauth/authorize",
      code: null,
      expires_at: 99,
    });
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      session_id: "login_session_1",
      state: "pending",
      last_message: null,
      failure_reason: null,
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add credential" }));
    const sheet = await screen.findByRole("dialog", { name: "Add credential" });
    await userEvent.type(within(sheet).getByLabelText("Name"), "claude-sub-2");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Platform" }));
    await userEvent.click(await screen.findByRole("option", { name: "anthropic-subscription" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Start sign-in" }));
    await waitFor(() =>
      expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
        platform: "anthropic-subscription",
        name: "claude-sub-2",
        mode: "copy_code",
        holder: "mac-studio",
      }),
    );
    expect(await within(sheet).findByLabelText("Paste code")).toBeInTheDocument();
  });

  it("rotates a copy on this instance and on each selected other holder", async () => {
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([
      copyOf("mac-studio", 3),
      copyOf("server", 5),
    ]);
    vi.mocked(credentialsApi.rotateCredential).mockResolvedValue(copyOf("mac-studio", 4));
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const rows = within(credentials).getAllByRole("listitem");
    const oldKey = rows.find((row) => row.textContent?.includes("old-key"));
    await userEvent.click(within(oldKey!).getByRole("button", { name: "Rotate" }));
    const sheet = await screen.findByRole("dialog", { name: "Rotate old-key" });
    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(await within(sheet).findByRole("button", { name: "server" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));
    await waitFor(() => expect(credentialsApi.rotateCredential).toHaveBeenCalledTimes(2));
    expect(credentialsApi.rotateCredential).toHaveBeenCalledWith(
      "llm",
      "old-key",
      { expected_revision: 3, secret: { key: "sk-2" } },
      "mac-studio",
    );
    expect(credentialsApi.rotateCredential).toHaveBeenCalledWith(
      "llm",
      "old-key",
      { expected_revision: 5, secret: { key: "sk-2" } },
      "server",
    );
  });

  it("lists each holder line after a partial rotate failure and keeps the sheet open", async () => {
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([
      copyOf("mac-studio", 3),
      copyOf("server", 5),
    ]);
    vi.mocked(credentialsApi.rotateCredential).mockImplementation(
      (_component, _name, _body, holder) =>
        holder === "server"
          ? Promise.reject(
              new ApiError(
                "conflict",
                "Credential revision conflict.",
                409,
                "credential.revision.conflict",
              ),
            )
          : Promise.resolve(copyOf("mac-studio", 4)),
    );
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const oldKey = within(credentials)
      .getAllByRole("listitem")
      .find((row) => row.textContent?.includes("old-key"));
    await userEvent.click(within(oldKey!).getByRole("button", { name: "Rotate" }));
    const sheet = await screen.findByRole("dialog", { name: "Rotate old-key" });
    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(await within(sheet).findByRole("button", { name: "server" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));
    expect(await within(sheet).findByText("Not every copy was rotated.")).toBeInTheDocument();
    expect(within(sheet).getByText("mac-studio: rotated.")).toBeInTheDocument();
    expect(
      within(sheet).getByText(
        "server: not rotated. The credential changed after this page read it. Reload it, review the newest revision, then try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a failed Reset key and retries with the revision of the reload", async () => {
    vi.mocked(instancesApi.readWorkerInstance)
      .mockResolvedValueOnce(MAC)
      .mockResolvedValue({ ...MAC, revision: 2 });
    vi.mocked(instancesApi.resetWorkerInstanceKey)
      .mockRejectedValueOnce(
        new ApiError(
          "conflict",
          "The worker instance changed after the read.",
          409,
          "worker.instance.revision_conflict",
        ),
      )
      .mockResolvedValue({ ...MAC, revision: 3, instance_configuration: "eyJyZXRyeSI6dHJ1ZX0" });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Reset key" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    expect(
      await within(dialog).findByText("The worker instance changed after the read."),
    ).toBeInTheDocument();
    await waitFor(() => expect(instancesApi.readWorkerInstance).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("(v2)")).toBeInTheDocument());
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    await waitFor(() =>
      expect(instancesApi.resetWorkerInstanceKey).toHaveBeenLastCalledWith(
        "mac-studio",
        "https://kd.example.com",
        2,
      ),
    );
    expect(await within(dialog).findByText("eyJyZXRyeSI6dHJ1ZX0")).toBeInTheDocument();
  });

  it("names the release page when the server version was not read", async () => {
    vi.mocked(gatewayApi.readServerVersion).mockRejectedValue(
      new ApiError("malformed", "The OpenAPI index holds no version.", 0),
    );
    vi.mocked(instancesApi.resetWorkerInstanceKey).mockResolvedValue({
      ...MAC,
      revision: 2,
      instance_configuration: "eyJuZXciOnRydWV9",
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Reset key" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    expect(await within(dialog).findByText("The server version was not read.")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: "https://github.com/kanthorlabs/kanthord/releases",
      }),
    ).toHaveAttribute("href", "https://github.com/kanthorlabs/kanthord/releases");
    expect(
      within(dialog).getByText(
        "Use the image docker.io/kanthorlabs/kanthord:<version> with the command serve worker.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no copy action while the platform list is not read", async () => {
    vi.mocked(credentialsApi.listCredentialPlatforms).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    expect(await screen.findByText("The daemon did not answer.")).toBeInTheDocument();
    expect(within(credentials).queryByRole("button", { name: "Rotate" })).not.toBeInTheDocument();
    expect(
      within(credentials).queryByRole("button", { name: "Sign in again" }),
    ).not.toBeInTheDocument();
  });

  it("shows a failed read of the projects with Retry", async () => {
    vi.mocked(projectsApi.listProjects)
      .mockRejectedValueOnce(new ApiError("unreachable", "The daemon did not answer.", 0))
      .mockResolvedValue(PROJECTS);
    mount();
    expect(
      await screen.findByText("The projects, bindings or credential platforms were not read."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(
        screen.queryByText("The projects, bindings or credential platforms were not read."),
      ).not.toBeInTheDocument(),
    );
    expect(projectsApi.listProjects).toHaveBeenCalledTimes(2);
  });
});
