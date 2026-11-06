import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as credentialsApi from "@/api/resources/credentials";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type { BindingSetEntry } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/worker-instances");
vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/credentials");

import { BindingSheet } from "./binding-sheet";

const REPOSITORY: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: { base_branch: "main" },
    ssh_credential: "github-ssh",
    credential: "github-main",
    link_trust: { actor_ids: ["octocat", "hubot"] },
  },
};

const CONVERSATION: BindingSetEntry = {
  kind: "conversation",
  config: {
    available: true,
    platform: "github",
    repository: "kanthorlabs/kanthord",
    credential: "github-main",
    reply_policy: { follows: { type: "assessment_passed" } },
    link_trust: { actor_ids: ["octocat"] },
  },
};

const onSave = vi.fn();

function mount(name: string, entry: BindingSetEntry) {
  return render(
    <MemoryRouter>
      <BindingSheet
        projectId="project_1"
        target={{ kind: entry.kind, name, entry }}
        bindingId={null}
        environment={null}
        takenNames={[name]}
        repositoryNames={[]}
        saving={false}
        conflict={false}
        errorMessage={null}
        instancesError={null}
        onSave={onSave}
        onEnvironmentChanged={vi.fn()}
        onEnvironmentWritten={vi.fn()}
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("BindingSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({ items: [] });
    vi.mocked(credentialsApi.listHostKeys).mockResolvedValue([
      {
        host: "github.com",
        public_key:
          "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl",
        fingerprint: "SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU",
        source: "github_meta",
        created_at: 1,
      },
    ]);
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(projectsApi.checkBinding).mockResolvedValue({
      address: { status: "healthy", capability: "network git read", failure_reason: null },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: null,
      instruction_file: null,
      instruction_file_hint: null,
    });
  });

  it("shows a conversation binding read-only and writes it back unchanged", async () => {
    mount("issues", CONVERSATION);

    expect(await screen.findByRole("form", { name: "Edit issues" })).toBeTruthy();
    expect(screen.getByText("kanthorlabs/kanthord")).toBeTruthy();
    expect(screen.getByText("octocat")).toBeTruthy();
    expect(screen.getByText("github-main")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(onSave).toHaveBeenCalledWith("issues", CONVERSATION);
  });

  it("shows link_trust of a repository binding and keeps it in the save", async () => {
    mount("kanthord-repo", REPOSITORY);

    expect(await screen.findByText("octocat, hubot")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(onSave).toHaveBeenCalledWith("kanthord-repo", REPOSITORY);
  });
});
