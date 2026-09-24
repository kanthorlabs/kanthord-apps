import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as workersApi from "@/api/resources/workers";
import * as projectsApi from "@/api/resources/projects";
import type { Binding, WorkerInstance, WorkerTemplate } from "@/api/types";

vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/projects");
vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { WorkersScreen } from "./workers-screen";

const TEMPLATE_GENERAL: WorkerTemplate = {
  name: "general@1",
  method: "steps method",
  agentName: "swe@1",
  agentKind: "native agent",
  declaredNodeStates: ["Available"],
  overridableOptions: ["model identifier", "reasoning effort"],
  defaultConfiguration: {
    provider: "openai",
    "model identifier": "gpt-4o-mini",
    "reasoning effort": "medium",
  },
  turnBudget: 200,
  wallTimeBudgetSeconds: 7200,
};

const BINDING_GENERAL: Binding = {
  id: "bnd-wkr-general",
  identity: "general-main",
  kind: "worker",
  revision: 2,
  disabled: false,
  workerName: "general@1",
  instanceCount: 2,
  available: true,
  agentEntries: {
    "model identifier": "gpt-4o",
    "reasoning effort": "high",
  },
  credentialReferences: [],
};

const INSTANCE_BUSY: WorkerInstance = {
  runtimeId: "rt-aaa",
  bindingId: "bnd-wkr-general",
  healthcheckPasses: true,
  healthcheckDetail: "The effective configuration resolves.",
  busy: true,
  executionId: "exec-1",
};

const INSTANCE_FAILING: WorkerInstance = {
  runtimeId: "rt-bbb",
  bindingId: "bnd-wkr-general",
  healthcheckPasses: false,
  healthcheckDetail: "The Claude Code program is absent from the host.",
  busy: false,
  executionId: null,
};

const BINDING_REPO: Binding = {
  id: "bnd-repo-main",
  identity: "main-repo",
  kind: "repository",
  revision: 1,
  disabled: false,
  credentialReferences: [],
};

function setup() {
  vi.mocked(workersApi.listTemplates).mockResolvedValue([TEMPLATE_GENERAL]);
  vi.mocked(projectsApi.listBindings).mockResolvedValue([BINDING_GENERAL, BINDING_REPO]);
  vi.mocked(workersApi.listInstances).mockResolvedValue([INSTANCE_BUSY, INSTANCE_FAILING]);
}

describe("WorkersScreen", () => {
  it("marks inherited and overridden effective configuration entries", async () => {
    setup();
    render(<WorkersScreen />);

    await waitFor(() => {
      expect(screen.getAllByText("overridden").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("overridden").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("inherited").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the reason text for a failing healthcheck", async () => {
    setup();
    render(<WorkersScreen />);

    expect(
      await screen.findByText("The Claude Code program is absent from the host."),
    ).toBeTruthy();
    expect(screen.getByText("Healthcheck failing")).toBeTruthy();
  });

  it("shows a confirmation with the busy instance count when decreasing instance count", async () => {
    setup();
    const user = userEvent.setup();
    render(<WorkersScreen />);

    const input = await screen.findByLabelText("Instance count for general-main");

    await user.clear(input);
    await user.type(input, "1");

    const applyButton = screen.getByRole("button", { name: "Apply" });
    await user.click(applyButton);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toMatch(/1.*instance.*busy/i);
    expect(dialog.textContent).toMatch(/finish.*current execution/i);
    expect(dialog.textContent).not.toMatch(/interrupted/i);
  });

  it("drain dialog never says interrupted and confirms busy instances finish their current execution", async () => {
    setup();
    const user = userEvent.setup();
    render(<WorkersScreen />);

    const input = await screen.findByLabelText("Instance count for general-main");

    await user.clear(input);
    await user.type(input, "1");

    const applyButton = screen.getByRole("button", { name: "Apply" });
    await user.click(applyButton);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).not.toMatch(/interrupted/i);
    expect(dialog.textContent).toMatch(/finish.*current execution/i);
  });

  it("executes instance count increase without confirmation", async () => {
    setup();
    vi.mocked(projectsApi.setInstanceCount).mockResolvedValue(BINDING_GENERAL);
    const user = userEvent.setup();
    render(<WorkersScreen />);

    const input = await screen.findByLabelText("Instance count for general-main");

    await user.clear(input);
    await user.type(input, "5");

    const applyButton = screen.getByRole("button", { name: "Apply" });
    await user.click(applyButton);

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(vi.mocked(projectsApi.setInstanceCount)).toHaveBeenCalledWith(
      "prj-test",
      "bnd-wkr-general",
      5,
    );
  });
});
