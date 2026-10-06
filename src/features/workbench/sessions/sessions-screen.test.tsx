import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentEnablement,
  AgentModel,
  AgentSummary,
  WorkbenchSession,
  WorkbenchSessionListItem,
} from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { SessionsScreen } from "./sessions-screen";

const ENABLEMENT: AgentEnablement = {
  agentName: "swe@1",
  state: "enabled",
  agentProviders: [
    { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" },
    { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
  ],
  defaultConfiguration: {
    agentProvider: "atlas-llm",
    modelIdentifier: "qwen3-coder",
    reasoningEffort: "off",
  },
  revision: 2,
};

const MODELS: Readonly<Record<string, readonly AgentModel[]>> = {
  "atlas-llm": [
    { modelIdentifier: "qwen3-coder", reasoningEfforts: ["off", "low"] },
    { modelIdentifier: "glm-4.6", reasoningEfforts: ["off"] },
  ],
  "openai-org": [
    { modelIdentifier: "gpt-5", reasoningEfforts: ["off", "low", "high"] },
    { modelIdentifier: "gpt-5-mini", reasoningEfforts: ["medium"] },
  ],
};

function agents(enablement: AgentEnablement | null): readonly AgentSummary[] {
  return [
    { agentName: "swe@1", workerNames: ["general-main"], enablement },
    { agentName: "re@1", workerNames: ["general-main"], enablement: null },
  ];
}

const OLD: WorkbenchSessionListItem = {
  id: "workbench_session_OLD",
  agentName: "swe@1",
  name: null,
  created: Date.parse("2026-10-01T09:00:00Z"),
  modified: Date.parse("2026-10-01T10:00:00Z"),
  messageCount: 4,
  firstMessage: "List the open objectives",
};
const NEW: WorkbenchSessionListItem = {
  id: "workbench_session_NEW",
  agentName: "swe@1",
  name: "Billing plan",
  created: Date.parse("2026-10-05T09:00:00Z"),
  modified: Date.parse("2026-10-05T10:00:00Z"),
  messageCount: 2,
  firstMessage: "Read the plan of Billing",
};

function Opened() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <p>Opened {sessionId}</p>;
}

function mount(entry = "/workbench?agentName=swe%401") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/workbench" element={<SessionsScreen />} />
        <Route path="/workbench/:sessionId" element={<Opened />} />
      </Routes>
    </MemoryRouter>,
  );
}

function serve(
  items: readonly WorkbenchSessionListItem[],
  enablement: AgentEnablement | null = ENABLEMENT,
) {
  vi.mocked(workbenchApi.listWorkbenchSessions).mockResolvedValue(items);
  vi.mocked(workersApi.listAgents).mockResolvedValue(agents(enablement));
  vi.mocked(workersApi.listAgentProviderModels).mockImplementation(
    async (_agentName, providerName) => MODELS[providerName] ?? [],
  );
}

async function openDialog() {
  await screen.findByText("No sessions of swe@1. Start the first one with New Session.");
  await userEvent.click(screen.getByRole("button", { name: "New Session" }));
  const dialog = await screen.findByRole("dialog");
  await choose(dialog, "Agent", "swe@1");
  return dialog;
}

async function choose(dialog: HTMLElement, label: string, option: string) {
  await userEvent.click(within(dialog).getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("SessionsScreen", () => {
  it("lists the sessions of every agent under All agents", async () => {
    serve([OLD, { ...NEW, agentName: "re@1" }]);
    mount("/workbench");

    const rows = within(await screen.findByRole("list", { name: "Sessions" })).getAllByRole(
      "listitem",
    );
    expect(workbenchApi.listWorkbenchSessions).toHaveBeenCalledWith(null);
    expect(within(rows[0]!).getByText("re@1")).toBeTruthy();
    expect(within(rows[1]!).getByText("swe@1")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Agent" })).toHaveTextContent("All agents");
  });

  it("opens New Session with a blank agent and offers only the enabled agents", async () => {
    serve([OLD]);
    mount("/workbench");

    await screen.findByRole("list", { name: "Sessions" });
    await userEvent.click(screen.getByRole("button", { name: "New Session" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("combobox", { name: "Agent" })).toHaveTextContent("Choose");
    expect(within(dialog).getByText("Pick an agent to start a session.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Start Session" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent" }));
    expect(await screen.findByRole("option", { name: "swe@1" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "re@1" })).toBeNull();
  });

  it("names the agent providers of the enablement and links to the agent page", async () => {
    serve([]);
    mount();

    const dialog = await openDialog();

    expect(
      within(dialog).getByText(/The enablement of swe@1 names 2 agent providers\./),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("link", { name: "Add an agent provider on the agent page." }),
    ).toHaveAttribute("href", "/agents/swe%401");
  });

  it("filters the sessions by the agent that the human picks", async () => {
    serve([OLD]);
    mount("/workbench");

    await screen.findByRole("list", { name: "Sessions" });
    await userEvent.click(screen.getByRole("combobox", { name: "Agent" }));
    await userEvent.click(await screen.findByRole("option", { name: "swe@1" }));

    await waitFor(() =>
      expect(workbenchApi.listWorkbenchSessions).toHaveBeenLastCalledWith("swe@1"),
    );
  });

  it("lists the sessions of the agent, newest modified first", async () => {
    serve([OLD, NEW]);
    mount();

    const rows = within(await screen.findByRole("list", { name: "Sessions" })).getAllByRole(
      "listitem",
    );
    expect(workbenchApi.listWorkbenchSessions).toHaveBeenCalledWith("swe@1");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("Billing plan")).toBeTruthy();
    expect(within(rows[1]!).getByText("List the open objectives")).toBeTruthy();
    expect(within(rows[1]!).getByText("4 messages")).toBeTruthy();
  });

  it("resumes the selected session", async () => {
    serve([OLD, NEW]);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Open Billing plan" }));

    expect(await screen.findByText("Opened workbench_session_NEW")).toBeTruthy();
  });

  it("names the next step when the agent holds no session", async () => {
    serve([]);
    mount();

    expect(
      await screen.findByText("No sessions of swe@1. Start the first one with New Session."),
    ).toBeTruthy();
  });

  it("reports a failed read with Retry", async () => {
    vi.mocked(workbenchApi.listWorkbenchSessions).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    vi.mocked(workersApi.listAgents).mockResolvedValue(agents(ENABLEMENT));
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("says that no agent is enabled when the dialog has no agent to offer", async () => {
    serve([], null);
    mount();

    await screen.findByText("No sessions of swe@1. Start the first one with New Session.");
    await userEvent.click(screen.getByRole("button", { name: "New Session" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText("No agent is enabled. Enable an agent on the Agents page."),
    ).toBeTruthy();
  });

  it("starts a session with the confirmed default configuration", async () => {
    serve([]);
    const created: WorkbenchSession = {
      id: "workbench_session_CREATED",
      agentName: "swe@1",
      configuration: ENABLEMENT.defaultConfiguration,
      entries: [],
      runActive: false,
    };
    vi.mocked(workbenchApi.createWorkbenchSession).mockResolvedValue(created);
    mount();

    const dialog = await openDialog();
    expect(within(dialog).getByRole("combobox", { name: "Agent Provider" })).toHaveValue(
      "atlas-llm",
    );
    expect(within(dialog).getByRole("combobox", { name: "Model Identifier" })).toHaveValue(
      "qwen3-coder",
    );
    expect(within(dialog).getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent(
      "off",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    expect(workbenchApi.createWorkbenchSession).toHaveBeenCalledWith({
      agentName: "swe@1",
      ...ENABLEMENT.defaultConfiguration,
    });
    expect(await screen.findByText("Opened workbench_session_CREATED")).toBeTruthy();
  });

  it("filters the models by the text that the human types", async () => {
    serve([]);
    mount();

    const dialog = await openDialog();
    const model = within(dialog).getByRole("combobox", { name: "Model Identifier" });
    await userEvent.clear(model);
    await userEvent.type(model, "glm");

    expect(await screen.findByRole("option", { name: "glm-4.6" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "qwen3-coder" })).toBeNull();
  });

  it("sends the configuration that the human changed", async () => {
    serve([]);
    vi.mocked(workbenchApi.createWorkbenchSession).mockResolvedValue({
      id: "workbench_session_CREATED",
      agentName: "swe@1",
      configuration: ENABLEMENT.defaultConfiguration,
      entries: [],
      runActive: false,
    });
    mount();

    const dialog = await openDialog();
    await choose(dialog, "Agent Provider", "openai-org");
    await choose(dialog, "Reasoning Effort", "high");
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    expect(workbenchApi.createWorkbenchSession).toHaveBeenCalledWith({
      agentName: "swe@1",
      agentProvider: "openai-org",
      modelIdentifier: "gpt-5",
      reasoningEffort: "high",
    });
  });

  it("lists the models of the selected agent provider and the efforts of the selected model", async () => {
    serve([]);
    mount();

    const dialog = await openDialog();
    await waitFor(() =>
      expect(workersApi.listAgentProviderModels).toHaveBeenCalledWith("swe@1", "atlas-llm"),
    );
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Model Identifier" }));
    await waitFor(() =>
      expect(screen.queryAllByRole("option").map((option) => option.textContent)).toEqual([
        "qwen3-coder",
        "glm-4.6",
      ]),
    );
    await userEvent.click(screen.getByRole("option", { name: "glm-4.6" }));
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Reasoning Effort" }));

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "off",
    ]);
  });

  it("resets the model to the first listed model when the agent provider changes", async () => {
    serve([]);
    mount();

    const dialog = await openDialog();
    await choose(dialog, "Agent Provider", "openai-org");

    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Model Identifier" })).toHaveValue(
        "gpt-5",
      ),
    );
    expect(within(dialog).getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent(
      "off",
    );
  });

  it("resets the model to the first listed model even when the new agent provider lists the current one", async () => {
    serve([]);
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(async (_agent, name) =>
      name === "openai-org"
        ? [
            { modelIdentifier: "gpt-5", reasoningEfforts: ["low", "high"] },
            { modelIdentifier: "qwen3-coder", reasoningEfforts: ["low", "high"] },
          ]
        : (MODELS[name] ?? []),
    );
    mount();

    const dialog = await openDialog();
    await choose(dialog, "Agent Provider", "openai-org");

    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent(
        "low",
      ),
    );
    expect(within(dialog).getByRole("combobox", { name: "Model Identifier" })).toHaveValue("gpt-5");
  });

  it("keeps the effort when the new model lists it and takes the first listed effort otherwise", async () => {
    serve([]);
    mount();

    const dialog = await openDialog();
    await waitFor(() => expect(workersApi.listAgentProviderModels).toHaveBeenCalled());
    await choose(dialog, "Reasoning Effort", "low");
    await choose(dialog, "Agent Provider", "openai-org");
    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Model Identifier" })).toHaveValue(
        "gpt-5",
      ),
    );
    expect(within(dialog).getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent(
      "low",
    );
    await choose(dialog, "Model Identifier", "gpt-5-mini");

    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent(
        "medium",
      ),
    );
  });

  it("keeps the default configuration selectable while the list loads", async () => {
    serve([]);
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(
      () => new Promise(() => undefined),
    );
    mount();

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Model Identifier" }));

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "qwen3-coder",
    ]);
  });

  it("shows a failed list inline and keeps the default configuration", async () => {
    serve([]);
    vi.mocked(workersApi.listAgentProviderModels).mockRejectedValue(
      new ApiError("not_found", "The agent provider does not exist.", 404),
    );
    mount();

    const dialog = await openDialog();

    expect(await within(dialog).findByText("The agent provider does not exist.")).toBeTruthy();
    expect(within(dialog).getByRole("combobox", { name: "Model Identifier" })).toHaveValue(
      "qwen3-coder",
    );
  });

  it("shows the refusal of the server and keeps the dialog open", async () => {
    serve([]);
    vi.mocked(workbenchApi.createWorkbenchSession).mockRejectedValue(
      new ApiError("refused", "The model is unknown.", 422),
    );
    mount();

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    expect(await within(dialog).findByText("The model is unknown.")).toBeTruthy();
  });

  it("closes the dialog on Cancel", async () => {
    serve([]);
    mount();

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
