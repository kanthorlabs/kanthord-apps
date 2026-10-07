import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type { RepositoryCredential } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/gateway");

import { RepositoryScreen } from "./repository-screen";

const GITHUB: RepositoryCredential = {
  name: "ci-github",
  platform: "github",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      revision: 1,
      metadata: null,
      created_at: Date.UTC(2026, 9, 1, 9, 0),
      ended_at: null,
    },
  ],
  bindings: [
    {
      project_id: "prj-atlas",
      project_name: "atlas",
      binding_id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR1",
      name: "source",
    },
  ],
};

function mount() {
  return render(
    <MemoryRouter initialEntries={["/repositories/ci-github"]}>
      <Routes>
        <Route path="/repositories/:credentialName" element={<RepositoryScreen />} />
        <Route path="/repositories" element={<p>Repository list</p>} />
        <Route path="/projects/:projectId" element={<p>Project view</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
    items: [
      {
        platform: "github",
        secret_shape: "api_key",
        login_modes: [],
        metadata_fields: [],
        verifiable: true,
      },
    ],
  });
});

describe("RepositoryScreen", () => {
  it("shows the credential detail and the bindings that name it", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue(GITHUB);
    mount();

    const bindings = await screen.findByRole("list", { name: "Bindings" });
    expect(within(bindings).getByText("source")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Revisions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(credentialsApi.readCredential).toHaveBeenCalledWith("repository", "ci-github");
    await waitFor(() =>
      expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("repository"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Bindings of atlas" }));

    expect(screen.getByText("Project view")).toBeTruthy();
  });

  it("states that no binding names the credential", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({ ...GITHUB, bindings: [] });
    mount();

    expect(await screen.findByText("No binding names this credential.")).toBeTruthy();
  });

  it("reports a name that is not a repository credential and links back to the section", async () => {
    vi.mocked(credentialsApi.readCredential).mockRejectedValue(
      new ApiError("not_found", "Credential not found.", 404, "credential.credential.not_found"),
    );
    mount();

    expect(await screen.findByText("Credential not found.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back to credentials" }));

    expect(screen.getByText("Repository list")).toBeTruthy();
  });
});
