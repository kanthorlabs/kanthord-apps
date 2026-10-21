import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as clientApi from "@/api/client";
import * as credentialsApi from "@/api/resources/credentials";
import * as gatewayApi from "@/api/resources/gateway";
import * as instancesApi from "@/api/resources/worker-instances";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type {
  CopyHealth,
  Credential,
  CredentialPlatformList,
  LlmCredential,
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

const REPORTED_AT = Date.UTC(2026, 9, 21, 8, 0);

const NO_REPORT: CopyHealth = {
  status: "unknown",
  capability: "model-list read",
  failure_reason: "held_by_instance",
  models: null,
  reported_at: null,
};

const ROUTER_HEALTH: CopyHealth = {
  status: "healthy",
  capability: "model-list read",
  failure_reason: null,
  models: [
    { id: "qwen3-coder", owned_by: "router", created: 1 },
    { id: "glm-4.6", owned_by: null, created: null },
  ],
  reported_at: REPORTED_AT,
};

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
    {
      name: "atlas-router",
      revision: 1,
      platform: "openai-compatible",
      sealed_current: true,
      health: ROUTER_HEALTH,
    },
    {
      name: "claude-sub",
      revision: 1,
      platform: "anthropic-subscription",
      sealed_current: true,
      health: {
        status: "unhealthy",
        capability: "model call",
        failure_reason: "unauthorized",
        models: null,
        reported_at: REPORTED_AT,
      },
    },
    {
      name: "old-key",
      revision: 3,
      platform: "anthropic",
      sealed_current: false,
      health: NO_REPORT,
    },
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

const ROUTER_COPY: LlmCredential = {
  name: "atlas-router",
  platform: "openai-compatible",
  holder: "mac-studio",
  sealed_to: FINGERPRINT,
  sealed_current: true,
  revisions: [
    {
      id: "r-router",
      revision: 1,
      metadata: { base_url: "https://router.example/v1", models: [{ id: "qwen3-coder" }] },
      created_at: 1,
      ended_at: null,
    },
  ],
  agent_providers: [],
};

function rowOf(credentials: HTMLElement, name: string): HTMLElement {
  const row = within(credentials)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name));
  expect(row).toBeDefined();
  return row!;
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

  it("marks a copy sealed to an ended key and disables Sign in again on a live copy", async () => {
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    expect(within(credentials).getByText("Re-enter: sealed to an ended key.")).toBeInTheDocument();
    const signIn = await within(rowOf(credentials, "claude-sub")).findByRole("button", {
      name: "Sign in again",
    });
    expect(signIn).toHaveAttribute("aria-disabled", "true");
    await userEvent.hover(signIn);
    expect(
      await screen.findByText(
        "The copy is live. The server refuses a new sign-in while the copy is sealed to the current key of the instance.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/a credential with a new name/)).not.toBeInTheDocument();
    expect(within(credentials).getAllByRole("button", { name: "Rotate" })).toHaveLength(2);
  });

  it("signs in again on a copy that is not live and adds the next revision on the instance", async () => {
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue({
      ...MAC,
      credentials: MAC.credentials.map((copy) =>
        copy.name === "claude-sub" ? { ...copy, sealed_current: false } : copy,
      ),
    });
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue({
      session_id: "login_session_2",
      address: "https://claude.ai/oauth/authorize",
      code: null,
      expires_at: 99,
    });
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      session_id: "login_session_2",
      state: "pending",
      last_message: null,
      failure_reason: null,
    });
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const signIn = await within(rowOf(credentials, "claude-sub")).findByRole("button", {
      name: "Sign in again",
    });
    expect(signIn).not.toHaveAttribute("aria-disabled");
    await userEvent.click(signIn);
    const sheet = await screen.findByRole("dialog", { name: "Sign in again to claude-sub" });
    expect(sheet).toHaveTextContent("copy-code mode");
    await userEvent.click(within(sheet).getByRole("button", { name: "Start sign-in" }));
    await waitFor(() =>
      expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
        platform: "anthropic-subscription",
        name: "claude-sub",
        mode: "copy_code",
        holder: "mac-studio",
      }),
    );
    expect(await within(sheet).findByLabelText("Paste code")).toBeInTheDocument();
  });

  it("shows an unhealthy report with the hint, the instance and the report time", async () => {
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const row = rowOf(credentials, "claude-sub");
    expect(within(row).getByText("Unhealthy")).toBeInTheDocument();
    expect(row).toHaveTextContent(
      "The provider refused the API key or the access token. Rotate the copy with a correct key, or sign in again. The instance checks the copy again after the write. Reported by mac-studio at 2026-10-21 08:00 UTC.",
    );
  });

  it("shows a healthy report with the instance and the report time", async () => {
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const row = rowOf(credentials, "atlas-router");
    expect(within(row).getByText("Healthy")).toBeInTheDocument();
    expect(row).toHaveTextContent("Reported by mac-studio at 2026-10-21 08:00 UTC.");
  });

  it("shows Unknown with no report since the server start", async () => {
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue({
      ...MAC,
      credentials: [
        {
          name: "atlas-router",
          revision: 2,
          platform: "openai-compatible",
          sealed_current: true,
          health: NO_REPORT,
        },
      ],
    });
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const row = rowOf(credentials, "atlas-router");
    expect(within(row).getByText("Unknown")).toBeInTheDocument();
    expect(row).toHaveTextContent(
      "No report from mac-studio for this revision since the server start.",
    );
    expect(row).not.toHaveTextContent("Reported by");
  });

  it("shows only the Re-enter notice for a copy sealed to an ended key", async () => {
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const row = rowOf(credentials, "old-key");
    expect(within(row).getByText("Re-enter")).toBeInTheDocument();
    expect(within(row).queryByText("Unknown")).not.toBeInTheDocument();
    expect(row).not.toHaveTextContent("No report");
    expect(within(row).queryByRole("button", { name: "Edit models" })).not.toBeInTheDocument();
  });

  it("edits the models of an openai-compatible copy with the reported model ids", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue(ROUTER_COPY);
    vi.mocked(credentialsApi.updateCredentialMetadata).mockResolvedValue(ROUTER_COPY);
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const row = rowOf(credentials, "atlas-router");
    await userEvent.click(await within(row).findByRole("button", { name: "Edit models" }));
    expect(credentialsApi.readCredential).toHaveBeenCalledWith("llm", "atlas-router", "mac-studio");
    const sheet = await screen.findByRole("dialog", {
      name: "Edit metadata of atlas-router on mac-studio",
    });
    const reported = within(sheet).getByRole("region", { name: "Reported models" });
    expect(within(reported).queryByRole("button", { name: "Add qwen3-coder" })).toBeNull();
    await userEvent.click(within(reported).getByRole("button", { name: "Add glm-4.6" }));
    expect(within(sheet).queryByRole("region", { name: "Reported models" })).toBeNull();
    await userEvent.click(within(sheet).getByRole("button", { name: "Save metadata" }));
    await waitFor(() =>
      expect(credentialsApi.updateCredentialMetadata).toHaveBeenCalledWith(
        "llm",
        "atlas-router",
        {
          expected_revision: 1,
          metadata: {
            base_url: "https://router.example/v1",
            models: [{ id: "qwen3-coder" }, { id: "glm-4.6" }],
          },
        },
        "mac-studio",
      ),
    );
  });

  it("offers Edit models only on an openai-compatible copy", async () => {
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    expect(await within(credentials).findAllByRole("button", { name: "Edit models" })).toHaveLength(
      1,
    );
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

  it("closes the Sign in again sheet and reads the instance again after the sign-in completes", async () => {
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue({
      ...MAC,
      credentials: MAC.credentials.map((copy) =>
        copy.name === "claude-sub" ? { ...copy, sealed_current: false } : copy,
      ),
    });
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue({
      session_id: "login_session_3",
      address: "https://claude.ai/oauth/authorize",
      code: null,
      expires_at: 99,
    });
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      session_id: "login_session_3",
      state: "completed",
      last_message: null,
      failure_reason: null,
    });
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    await userEvent.click(
      await within(rowOf(credentials, "claude-sub")).findByRole("button", {
        name: "Sign in again",
      }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Sign in again to claude-sub" });
    const reads = vi.mocked(instancesApi.readWorkerInstance).mock.calls.length;
    const success = vi.spyOn(toast, "success");
    await userEvent.click(within(sheet).getByRole("button", { name: "Start sign-in" }));
    await waitFor(
      () =>
        expect(
          screen.queryByRole("dialog", { name: "Sign in again to claude-sub" }),
        ).not.toBeInTheDocument(),
      { timeout: 4000 },
    );
    expect(vi.mocked(instancesApi.readWorkerInstance).mock.calls.length).toBeGreaterThan(reads);
    expect(success.mock.calls).toEqual([["Stored a new revision of claude-sub for mac-studio."]]);
  });

  it("shows one success toast when the sign-in of Add credential completes", async () => {
    const success = vi.spyOn(toast, "success");
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue({
      session_id: "login_session_4",
      address: "https://claude.ai/oauth/authorize",
      code: null,
      expires_at: 99,
    });
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      session_id: "login_session_4",
      state: "completed",
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
    await waitFor(
      () =>
        expect(screen.queryByRole("dialog", { name: "Add credential" })).not.toBeInTheDocument(),
      { timeout: 4000 },
    );
    expect(success.mock.calls).toEqual([["Stored claude-sub-2 for mac-studio."]]);
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

  it("shows the Docker steps of the new configuration on a Docker choice", async () => {
    vi.mocked(instancesApi.resetWorkerInstanceKey).mockResolvedValue({
      ...MAC,
      revision: 2,
      instance_configuration: "eyJkb2NrZXIiOnRydWV9",
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Reset key" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container" }));
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Container runtime" }));
    await userEvent.click(await screen.findByRole("option", { name: "Docker" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    expect(
      await within(dialog).findByText("Run the instance: Container with Docker"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Give the file to docker run with --env-file/),
    ).toBeInTheDocument();
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
