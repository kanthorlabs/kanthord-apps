import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import * as projectsApi from "@/api/resources/projects";
import type { Binding, PermittedClientIdentity } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { SettingsScreen } from "./settings-screen";

const REPO_BINDING_REQUEST_REPLY: Binding = {
  id: "bnd-repo-main",
  identity: "main-repo",
  kind: "repository",
  revision: 1,
  disabled: false,
  platform: "GitHub",
  repositoryAddress: "git@github.com:org/repo.git",
  transportForm: "SSH",
  requiredCapabilities: ["network git read"],
  strategy: {
    baseBranch: "main",
    configuredAction: "open a pull request",
    actionKind: "request-reply action",
    expectedEndState: "merged",
  },
  credentialReferences: [
    {
      capability: "network git read",
      recordId: "cs-ssh-key-1",
      recordType: "SSH key",
      upstreamPrincipal: "org",
      configuringActor: "ulrich",
    },
  ],
};

const REPO_BINDING_FIRE_AND_FORGET: Binding = {
  id: "bnd-repo-notify",
  identity: "notify-repo",
  kind: "repository",
  revision: 1,
  disabled: false,
  platform: "GitHub",
  repositoryAddress: "git@github.com:org/notify.git",
  transportForm: "SSH",
  requiredCapabilities: ["network git write"],
  strategy: {
    baseBranch: "main",
    configuredAction: "push a commit",
    actionKind: "fire-and-forget action",
    expectedEndState: null,
  },
  credentialReferences: [],
};

const PROVIDER_BINDING: Binding = {
  id: "bnd-prv-openai",
  identity: "openai-dev",
  kind: "provider account",
  revision: 1,
  disabled: false,
  provider: "openai",
  account: "kanthorlabs-dev",
  isDefaultAccount: true,
  credentialReferences: [
    {
      capability: "a model inference call",
      recordId: "cs-api-openai",
      recordType: "API key",
      upstreamPrincipal: "kanthorlabs-dev",
      configuringActor: "ulrich",
    },
  ],
};

const SOURCE_BINDING: Binding = {
  id: "bnd-src-gh",
  identity: "github-webhook",
  kind: "source",
  revision: 1,
  disabled: false,
  deliverySource: "The GitHub webhook source of org/repo",
  credentialReferences: [],
};

const WORKER_BINDING: Binding = {
  id: "bnd-wkr-main",
  identity: "general-main",
  kind: "worker",
  revision: 2,
  disabled: false,
  workerName: "general@1",
  instanceCount: 2,
  available: true,
  agentEntries: {},
  credentialReferences: [],
};

const CLIENT_IDENTITY_EXECUTOR: PermittedClientIdentity = {
  id: "ci-1",
  clientIdentity: "claude-code-executor",
  role: "executor",
  executionCount: 5,
  liveExecutions: 0,
};

const CLIENT_IDENTITY_REVIEWER: PermittedClientIdentity = {
  id: "ci-2",
  clientIdentity: "claude-code-reviewer",
  role: "reviewer",
  executionCount: 2,
  liveExecutions: 1,
};

function setupDefault() {
  vi.mocked(projectsApi.listBindings).mockResolvedValue([
    REPO_BINDING_REQUEST_REPLY,
    REPO_BINDING_FIRE_AND_FORGET,
    PROVIDER_BINDING,
    SOURCE_BINDING,
    WORKER_BINDING,
  ]);
  vi.mocked(projectsApi.listClientIdentities).mockResolvedValue([
    CLIENT_IDENTITY_EXECUTOR,
    CLIENT_IDENTITY_REVIEWER,
  ]);
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <SettingsScreen />
    </MemoryRouter>,
  );
}

describe("SettingsScreen — fire-and-forget expected end state", () => {
  it('renders "none" for expected end state on a fire-and-forget action', async () => {
    setupDefault();
    renderScreen();

    const notifyHeading = await screen.findByText("notify-repo");
    const cardEl = notifyHeading.closest('[role="listitem"]');
    expect(cardEl).toBeTruthy();
    expect(cardEl?.textContent).toContain("fire-and-forget");
    expect(cardEl?.textContent).toContain("none");
    expect(cardEl?.textContent).not.toContain("merged");
  });
});

describe("SettingsScreen — no secret material in bindings", () => {
  it("shows provenance fields but no secret values or reveal controls for credentials", async () => {
    setupDefault();
    renderScreen();

    expect(await screen.findByText("cs-ssh-key-1")).toBeTruthy();

    expect(screen.getAllByText(/stays in custody/i).length).toBeGreaterThan(0);

    expect(screen.queryByRole("button", { name: /reveal/i })).toBeNull();

    expect(screen.queryByRole("button", { name: /copy new client secret/i })).toBeNull();
  });
});

describe("SettingsScreen — role editor absence", () => {
  it("renders the role as text and states a different role needs a different identity", async () => {
    setupDefault();
    renderScreen();

    expect(await screen.findByText("claude-code-executor")).toBeTruthy();

    expect(screen.queryByRole("combobox", { name: /role/i })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();

    const messages = screen.getAllByText(/different role requires a different client identity/i);
    expect(messages.length).toBeGreaterThan(0);

    expect(screen.getAllByText("executor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("reviewer").length).toBeGreaterThan(0);
  });
});

describe("SettingsScreen — rotate secret flow", () => {
  it("warns that the previous secret stops working and the new secret is shown once", async () => {
    setupDefault();
    vi.mocked(projectsApi.rotateClientSecret).mockResolvedValue({
      clientSecret: "new-secret-xyz",
    });
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("claude-code-executor");

    const rotateButtons = screen.getAllByRole("button", { name: /rotate secret/i });
    await user.click(rotateButtons[0]!);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/previous secret stops working/i);
    expect(dialog.textContent).toMatch(/shown one time/i);
    expect(dialog.textContent).toMatch(/cannot be retrieved again/i);

    const confirmButton = screen.getByRole("button", { name: /^rotate$/i });
    await user.click(confirmButton);

    expect(await screen.findByText("new-secret-xyz")).toBeTruthy();
    expect(screen.getByText(/shown once only/i)).toBeTruthy();
    expect(screen.getByText(/will not be shown again/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy new client secret/i })).toBeTruthy();
  });
});
