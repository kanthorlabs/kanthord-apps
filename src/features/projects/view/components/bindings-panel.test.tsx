import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import type { BindingSet, BindingSetEntry } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");

import { BindingsPanel } from "./bindings-panel";

const REPO: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: { baseBranch: "main" },
    credential: "github-main",
  },
};
const WORKER: BindingSetEntry = {
  kind: "worker",
  config: { worker: "general@1", instanceCount: 2 },
};

const SET: BindingSet = { version: 2, bindings: { "kanthord-repo": REPO, "general-main": WORKER } };

const onWritten = vi.fn();

function mount() {
  return render(<BindingsPanel projectId="project_1" onWritten={onWritten} />);
}

describe("BindingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue(SET);
    vi.mocked(projectsApi.writeBindingSet).mockResolvedValue({
      projectId: "project_1",
      bindingSetVersion: 3,
      changes: [],
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
    await userEvent.type(credential, "github-2");
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    expect(projectsApi.writeBindingSet).toHaveBeenCalledWith("project_1", 2, {
      "kanthord-repo": { ...REPO, config: { ...REPO.config, credential: "github-2" } },
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
      "git@github.com:kanthorlabs/kanthord.git · github · credential github-main",
    );
    expect(row).not.toHaveTextContent("base main");
  });

  it("separates the connection from the project policy in the repository form", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit kanthord-repo" }));
    const connection = screen.getByRole("group", { name: "Repository" });
    const policy = screen.getByRole("group", { name: "Project policy" });
    expect(within(connection).getByLabelText("Address")).toBeTruthy();
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
});
