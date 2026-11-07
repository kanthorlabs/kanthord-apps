import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import type { ExternalLink, ProjectBindingRecord } from "@/api/types";
import { useNodeCreate } from "@/hooks/use-node-create";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { NodeCreateDialog } from "./node-create-dialog";

const LINK: ExternalLink = {
  kind: "github_issue",
  resource_identity: "conversation:github:acme/shop",
  number: 42,
};

function binding(
  id: string,
  name: string,
  kind: ProjectBindingRecord["kind"],
  resourceIdentity: string,
): ProjectBindingRecord {
  return {
    id,
    project_id: "prj-1",
    name,
    kind,
    resource_identity: resourceIdentity,
    revision: 1,
    config: {},
    created_at: 1,
    removed_at: null,
  };
}

const BINDINGS = [
  binding("binding_chat", "shop-github", "conversation", "conversation:github:acme/shop"),
  binding("binding_repo", "shop-repo", "repository", "repository:github:acme/shop"),
  binding("binding_other", "other-chat", "conversation", "conversation:github:acme/other"),
];

function Harness({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useNodeCreate({
    projectId: "prj-1",
    link: LINK,
    subject: "acme/shop#42",
    onClose,
    onCreated,
  });
  return (
    <NodeCreateDialog create={create} message={<p>Can you also cover the Google sign-in?</p>} />
  );
}

async function renderDialog() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(<Harness onClose={onClose} onCreated={onCreated} />);
  const dialog = await screen.findByRole("dialog", { name: "Create node" });
  await waitFor(() =>
    expect(within(dialog).getByRole("checkbox", { name: /shop-github/ })).toBeChecked(),
  );
  return { dialog, onClose, onCreated };
}

async function fill(dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  await user.type(within(dialog).getByLabelText("File name"), "google-sign-in.md");
  await user.type(within(dialog).getByLabelText("Name"), "Google sign-in");
  await user.type(within(dialog).getByLabelText("Requirement"), "Offer Google sign-in.");
  await user.type(within(dialog).getByLabelText("Criterion"), "A user signs in with Google.");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(projectsApi.listBindings).mockResolvedValue(BINDINGS);
  vi.mocked(missionApi.readMission).mockResolvedValue({
    id: "mission_1",
    project_id: "prj-1",
    version: 7,
  });
  vi.mocked(missionApi.createMissionNode).mockResolvedValue({} as never);
});

describe("NodeCreateDialog", () => {
  it("shows the message beside the fields and copies no text into them", async () => {
    const { dialog } = await renderDialog();

    expect(within(dialog).getByText("Can you also cover the Google sign-in?")).toBeVisible();
    for (const label of ["File name", "Name", "Requirement", "Criterion", "Verification 1"]) {
      expect(within(dialog).getByLabelText(label)).toHaveValue("");
    }
  });

  it("preselects the conversation binding of the resource and no other", async () => {
    const { dialog } = await renderDialog();

    expect(within(dialog).getByRole("checkbox", { name: /shop-github/ })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: /shop-repo/ })).not.toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: /other-chat/ })).not.toBeChecked();
  });

  it("refuses a submit with no verification", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderDialog();
    await fill(dialog, user);
    await user.click(within(dialog).getByRole("checkbox", { name: /shop-repo/ }));

    await user.click(within(dialog).getByRole("button", { name: "Create node" }));

    expect(await within(dialog).findByText("Add at least one verification.")).toBeVisible();
    expect(missionApi.createMissionNode).not.toHaveBeenCalled();
  });

  it("refuses an implement node with no repository binding", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderDialog();
    await fill(dialog, user);
    await user.type(within(dialog).getByLabelText("Verification 1"), "pnpm test");

    await user.click(within(dialog).getByRole("button", { name: "Create node" }));

    expect(await within(dialog).findByText(/needs a repository binding/)).toBeVisible();
    expect(missionApi.createMissionNode).not.toHaveBeenCalled();
  });

  it("accepts an examine node with no repository binding", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderDialog();
    await fill(dialog, user);
    await user.type(within(dialog).getByLabelText("Verification 1"), "pnpm test");
    await user.click(within(dialog).getByRole("radio", { name: "examine" }));

    await user.click(within(dialog).getByRole("button", { name: "Create node" }));

    await waitFor(() => expect(missionApi.createMissionNode).toHaveBeenCalledTimes(1));
  });

  it("sends mission.node.create with the link, the bindings, no task and the mission version", async () => {
    const user = userEvent.setup();
    const { dialog, onClose, onCreated } = await renderDialog();
    await fill(dialog, user);
    await user.type(within(dialog).getByLabelText("Verification 1"), "pnpm test");
    await user.click(within(dialog).getByRole("button", { name: "Add verification" }));
    await user.type(within(dialog).getByLabelText("Verification 2"), "pnpm lint");
    await user.click(within(dialog).getByRole("checkbox", { name: /shop-repo/ }));

    await user.click(within(dialog).getByRole("button", { name: "Create node" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(missionApi.readMission).toHaveBeenCalledWith("prj-1");
    expect(missionApi.createMissionNode).toHaveBeenCalledWith("mission_1", {
      expected_mission_version: 7,
      filename: "google-sign-in.md",
      content: {
        name: "Google sign-in",
        requirement: "Offer Google sign-in.",
        criterion: "A user signs in with Google.",
        verifications: ["pnpm test", "pnpm lint"],
        bindings: ["binding_chat", "binding_repo"],
        intent: "implement",
        external_links: [LINK],
      },
      tasks: [],
      reason: expect.stringContaining("acme/shop#42"),
    });
    expect(onClose).toHaveBeenCalled();
  });
});
