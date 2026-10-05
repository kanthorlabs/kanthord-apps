import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import type { BindingSet, BindingSetEntry, ProjectBindingRecord } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";

import { BindingsPanel } from "./bindings-panel";

const REPO: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: { baseBranch: "main" },
    sshCredential: "github-ssh",
    credential: "github-main",
  },
};
const WORKER: BindingSetEntry = {
  kind: "worker",
  config: { worker: "general@1", instanceCount: 2 },
};

const SET: BindingSet = { version: 2, bindings: { "kanthord-repo": REPO, "general-main": WORKER } };

const BINDING_REPO: ProjectBindingRecord = {
  id: "binding_REPO1",
  projectId: "project_1",
  name: "kanthord-repo",
  kind: "repository",
  resourceIdentity: "repository:github:kanthorlabs/kanthord",
  revision: 1,
  config: REPO.config,
  createdAt: 1,
  removedAt: null,
};

const BINDING_WORKER: ProjectBindingRecord = {
  id: "binding_WORK1",
  projectId: "project_1",
  name: "general-main",
  kind: "worker",
  resourceIdentity: "worker:kanthord:general-main",
  revision: 1,
  config: WORKER.config,
  createdAt: 1,
  removedAt: null,
};

const onWritten = vi.fn();

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
              createdAt: 1,
              endedAt: null,
            },
          ],
        },
        {
          name: "github-main",
          platform: "github",
          revisions: [{ id: "rev_1", revision: 1, metadata: null, createdAt: 1, endedAt: null }],
        },
        { name: "github-kanthorlabs", platform: "github", revisions: [] },
      ],
      nextCursor: null,
    });
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
      items: [
        {
          platform: "ssh",
          secretShape: "none",
          loginModes: [],
          metadataFields: ["host", "hostname", "identity_file"],
          verifiable: true,
        },
        {
          platform: "github",
          secretShape: "api_key",
          loginModes: [],
          metadataFields: [],
          verifiable: true,
        },
      ],
    });
    vi.mocked(projectsApi.listBindings).mockResolvedValue([BINDING_REPO, BINDING_WORKER]);
    vi.mocked(projectsApi.writeBindingSet).mockResolvedValue({
      projectId: "project_1",
      bindingSetVersion: 3,
      changes: [],
    });
    vi.mocked(projectsApi.verifyBinding).mockResolvedValue({
      address: { status: "healthy", capability: "network git read" },
      sshCredential: { status: "healthy", capability: "ssh credential verify" },
      credential: { status: "healthy", capability: "repository credential verify" },
    });
    vi.mocked(projectsApi.checkBinding).mockResolvedValue({
      address: { status: "healthy", capability: "network git read" },
      sshCredential: { status: "healthy", capability: "ssh credential verify" },
      credential: null,
    });
    vi.mocked(missionApi.readMission).mockResolvedValue({
      id: "mission_1",
      projectId: "project_1",
      version: 3,
    });
    vi.mocked(missionApi.exportMissionJson).mockResolvedValue({
      missionId: "mission_1",
      missionVersion: 3,
      entries: [
        {
          filename: "reset-email.md",
          id: "node_1",
          kind: "objective",
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
    expect(within(repositories).getByText("available")).toBeTruthy();
    expect(
      within(screen.getByRole("list", { name: "Workers" })).getByText("general-main"),
    ).toBeTruthy();
    expect(screen.getByText("No storage binding.")).toBeTruthy();
  });

  it("writes a revision as the whole set at the read version without a guard", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const credential = screen.getByLabelText("Credential");
    await userEvent.clear(credential);
    await userEvent.type(credential, "kanth");
    await userEvent.click(
      await screen.findByRole("option", { name: "github-kanthorlabs · github" }),
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
    expect(within(connection).getByLabelText("Credential")).toBeTruthy();
    expect(within(policy).getByLabelText("Base branch")).toBeTruthy();
    expect(within(policy).getByLabelText("External action")).toBeTruthy();
    expect(within(policy).getByLabelText("Project prompt")).toBeTruthy();
  });

  it("keeps the draft and does not resend after a version conflict", async () => {
    vi.mocked(projectsApi.writeBindingSet).mockRejectedValue(
      new ApiError("conflict", "The submitted binding-set version differs.", 409),
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

  it("refuses a new binding whose name the project already uses", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add workers binding" }));
    await userEvent.type(screen.getByLabelText("Name"), "general-main");
    await userEvent.type(screen.getByLabelText("Worker"), "general@1");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(screen.getByText("Another binding of this project uses this name.")).toBeTruthy();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
  });

  it("presses Verify on kanthord-repo and shows address and credential badges", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify kanthord-repo" }));

    expect(await screen.findByText("Address · Healthy")).toBeTruthy();
    expect(screen.getByText("SSH credential · Healthy")).toBeTruthy();
    expect(screen.getByText("Credential · Healthy")).toBeTruthy();
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
              createdAt: 1,
              endedAt: null,
            },
          ],
        },
        {
          name: "github-main",
          platform: "github",
          revisions: [{ id: "rev_1", revision: 1, metadata: null, createdAt: 1, endedAt: null }],
        },
        { name: "github-kanthorlabs", platform: "github", revisions: [] },
        { name: "github-new", platform: "github", revisions: [] },
      ],
      nextCursor: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const newCredentialButtons = await screen.findAllByRole("button", { name: "New credential" });
    await userEvent.click(newCredentialButtons[newCredentialButtons.length - 1] as HTMLElement);

    const createForm = await screen.findByRole("form", { name: "New credential" });
    await userEvent.type(within(createForm).getByLabelText("Name"), "github-new");
    await userEvent.type(within(createForm).getByLabelText("API key"), "ghp-secret");
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
