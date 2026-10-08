import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as projectsApi from "@/api/resources/projects";
import type { InstructionFile, InstructionFiles, RepositoryBindingConfig } from "@/api/types";
import { draftOf, type RepositoryDraft } from "@/lib/binding-draft";
import { RepositoryInstructions } from "./repository-instructions";

vi.mock("@/api/resources/projects");

const SAVED: RepositoryBindingConfig = {
  available: true,
  platform: "github",
  address: "git@github.com:kanthorlabs/web-app.git",
  strategy: { base_branch: "main" },
  ssh_credential: "github-ssh",
};

const AGENTS: InstructionFile = {
  source: "agents_md",
  path: "AGENTS.md",
  state: "present",
  reason: null,
  text: "# Agent rules",
};
const AGENTS_LOCAL: InstructionFile = {
  source: "agents_local_md",
  path: "AGENTS.local.md",
  state: "absent",
  reason: null,
  text: null,
};
const CLAUDE: InstructionFile = {
  source: "claude_md",
  path: "CLAUDE.md",
  state: "present",
  reason: null,
  text: "# Claude rules",
};
const CLAUDE_LOCAL: InstructionFile = {
  source: "claude_local_md",
  path: "CLAUDE.local.md",
  state: "absent",
  reason: null,
  text: null,
};

function filesOf(files: readonly InstructionFile[]): InstructionFiles {
  return {
    commit: "3f2a9c1d4e5b6a7988776655443322110fedcba9",
    read_at: Date.now() - 120_000,
    files,
  };
}

function draftFrom(config: RepositoryBindingConfig): RepositoryDraft {
  const draft = draftOf("web-app", { kind: "repository", config });
  if (draft.kind !== "repository") throw new Error("fixture");
  return draft;
}

function Harness({
  saved,
  initial,
  bindingId = "binding_WEB1",
}: {
  readonly saved: RepositoryBindingConfig | null;
  readonly initial: RepositoryDraft;
  readonly bindingId?: string | null;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <MemoryRouter>
      <RepositoryInstructions
        projectId="project_1"
        bindingId={bindingId}
        saved={saved}
        draft={draft}
        onEdit={setDraft}
      />
      <output aria-label="draft">
        {JSON.stringify({ prompt: draft.projectPrompt, layer: draft.workingLayer })}
      </output>
    </MemoryRouter>
  );
}

function draftState(): { prompt: string; layer: Record<string, boolean> } {
  return JSON.parse(screen.getByLabelText("draft").textContent ?? "{}");
}

function mount(
  config: RepositoryBindingConfig = SAVED,
  saved: RepositoryBindingConfig | null = SAVED,
) {
  return render(<Harness saved={saved} initial={draftFrom(config)} />);
}

describe("RepositoryInstructions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.readInstructionFiles).mockResolvedValue(
      filesOf([AGENTS, AGENTS_LOCAL, CLAUDE, CLAUDE_LOCAL]),
    );
  });

  it("shows one skeleton row per file name while it reads, and keeps the Project prompt row", async () => {
    vi.mocked(projectsApi.readInstructionFiles).mockReturnValue(new Promise(() => undefined));
    mount();

    expect(screen.getByRole("status", { name: "Reading the instruction files" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit Project prompt" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "AGENTS.md" })).toBeNull();
  });

  it("shows the base branch, the short commit and the age of the read in the header", async () => {
    mount();

    expect(await screen.findByText("main · 3f2a9c1 · read 2 minutes ago")).toBeTruthy();
    expect(screen.getByText(/at the execution, so this list is a snapshot/)).toBeTruthy();
    expect(projectsApi.readInstructionFiles).toHaveBeenCalledWith("project_1", "binding_WEB1");
  });

  it("lists the present files and hides the absent files behind a footer", async () => {
    mount();

    const list = await screen.findByRole("list", { name: "Repository instructions" });
    expect(within(list).getByRole("button", { name: "AGENTS.md" })).toBeTruthy();
    expect(within(list).getByRole("button", { name: "CLAUDE.md" })).toBeTruthy();
    expect(within(list).queryByText("AGENTS.local.md")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Show 2 absent files" }));

    expect(await within(list).findByText("AGENTS.local.md")).toBeTruthy();
    expect(within(list).getByText("CLAUDE.local.md")).toBeTruthy();
    expect(within(list).getByRole("switch", { name: "AGENTS.local.md switch" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /absent file/ })).toBeNull();
  });

  it("expands a present file to its Markdown", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "AGENTS.md" }));

    expect(await screen.findByRole("heading", { name: "Agent rules" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy markdown of AGENTS.md" })).toBeTruthy();
  });

  it("shows an invalid file as a row with its reason", async () => {
    vi.mocked(projectsApi.readInstructionFiles).mockResolvedValue(
      filesOf([
        { ...AGENTS, state: "invalid", reason: "The text holds a NUL byte.", text: null },
        AGENTS_LOCAL,
        CLAUDE,
        CLAUDE_LOCAL,
      ]),
    );
    mount();

    expect(await screen.findByText("The text holds a NUL byte.")).toBeTruthy();
    expect(screen.getByText("invalid")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "AGENTS.md" })).toBeNull();
  });

  it("names the four files and the base branch when the repository holds none", async () => {
    vi.mocked(projectsApi.readInstructionFiles).mockResolvedValue(
      filesOf(
        [AGENTS, AGENTS_LOCAL, CLAUDE, CLAUDE_LOCAL].map((file) => ({
          ...file,
          state: "absent" as const,
          text: null,
        })),
      ),
    );
    mount();

    expect(
      await screen.findByText(
        "web-app holds none of AGENTS.md, AGENTS.local.md, CLAUDE.md, CLAUDE.local.md on main.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /absent file/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Project prompt" })).toBeTruthy();
  });

  it("reads again when the human presses Refresh", async () => {
    mount();
    await screen.findByRole("button", { name: "AGENTS.md" });

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(projectsApi.readInstructionFiles).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "AGENTS.md" })).toBeTruthy();
  });

  it("shows a refused read with its code, hides the files and offers Retry and the SSH credential", async () => {
    vi.mocked(projectsApi.readInstructionFiles).mockRejectedValueOnce(
      new ApiError(
        "refused",
        "The repository did not answer.",
        422,
        "project.bindings.repository.ssh_unreachable",
      ),
    );
    mount();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("project.bindings.repository.ssh_unreachable");
    expect(alert).toHaveTextContent("The repository did not answer.");
    expect(
      within(alert).getByRole("button", { name: "Open SSH credential github-ssh" }),
    ).toHaveAttribute("href", "/repositories/github-ssh");
    expect(screen.queryByRole("button", { name: "AGENTS.md" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Project prompt" })).toBeTruthy();

    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("button", { name: "AGENTS.md" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("makes no read for a new binding", async () => {
    mount(SAVED, null);

    expect(screen.getByText("Save the binding to read its instruction files.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Project prompt" })).toBeTruthy();
    expect(projectsApi.readInstructionFiles).not.toHaveBeenCalled();
  });

  it.each([
    ["address", { ...SAVED, address: "git@github.com:kanthorlabs/other.git" }],
    ["SSH credential", { ...SAVED, ssh_credential: "other-ssh" }],
    ["base branch", { ...SAVED, strategy: { base_branch: "develop" } }],
  ])("makes no read for a draft that changes the %s", async (_name, changed) => {
    mount(changed);

    expect(screen.getByText("Save the binding to read its instruction files.")).toBeTruthy();
    expect(projectsApi.readInstructionFiles).not.toHaveBeenCalled();
  });

  it("dims a row and shows off when its switch turns off, and writes the draft", async () => {
    mount();
    await screen.findByRole("button", { name: "CLAUDE.md" });

    await userEvent.click(screen.getByRole("switch", { name: "CLAUDE.md switch" }));

    expect(draftState().layer["claude_md"]).toBe(false);
    expect(draftState().layer["agents_md"]).toBe(true);
    expect(screen.getByText("off")).toBeTruthy();
  });

  it("starts a switch of the saved working layer in the off position", async () => {
    mount({
      ...SAVED,
      working_layer: {
        agents_md: false,
        agents_local_md: true,
        claude_md: true,
        claude_local_md: true,
        project_prompt: false,
      },
    });

    await screen.findByRole("button", { name: "AGENTS.md" });

    expect(screen.getByRole("switch", { name: "AGENTS.md switch" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Project prompt switch" })).not.toBeChecked();
    expect(screen.getAllByText("off")).toHaveLength(2);
  });

  it("shows an empty Project prompt as an absent row", async () => {
    mount();

    const row = (await screen.findByRole("button", { name: "Edit Project prompt" })).closest(
      "[role=listitem]",
    ) as HTMLElement;
    expect(row).toHaveTextContent("Project prompt");
    expect(row).toHaveTextContent("absent");
  });

  it("expands a filled Project prompt to its Markdown", async () => {
    mount({ ...SAVED, project_prompt: "# Project rules" });

    await userEvent.click(await screen.findByRole("button", { name: "Project prompt" }));

    expect(await screen.findByRole("heading", { name: "Project rules" })).toBeTruthy();
  });

  it("writes the Project prompt to the draft only when the human applies", async () => {
    mount();
    await screen.findByRole("button", { name: "AGENTS.md" });
    await userEvent.click(screen.getByRole("button", { name: "Edit Project prompt" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit Project prompt" });
    await userEvent.type(within(dialog).getByLabelText("Project prompt markdown"), "Use pnpm.");
    expect(draftState().prompt).toBe("");

    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(draftState().prompt).toBe("Use pnpm.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
  });

  it("discards the Project prompt text when the human cancels", async () => {
    mount({ ...SAVED, project_prompt: "Old text" });
    await userEvent.click(await screen.findByRole("button", { name: "Edit Project prompt" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit Project prompt" });
    const field = within(dialog).getByLabelText("Project prompt markdown");
    expect(field).toHaveValue("Old text");
    await userEvent.type(field, " and more");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(draftState().prompt).toBe("Old text");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("turns the Project prompt switch off in the draft", async () => {
    mount();

    await userEvent.click(await screen.findByRole("switch", { name: "Project prompt switch" }));

    expect(draftState().layer["project_prompt"]).toBe(false);
  });
});
