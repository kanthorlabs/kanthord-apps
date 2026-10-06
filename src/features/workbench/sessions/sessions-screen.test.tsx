import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentDeclaration,
  AgentEnablement,
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

function agent(enablement: AgentEnablement | null): AgentDeclaration {
  return {
    agentName: "swe@1",
    configurationSchema: {},
    overridableFields: [],
    enablement,
    agentPrompt: "",
    tools: [],
  };
}

const OLD: WorkbenchSessionListItem = {
  id: "workbench_session_OLD",
  name: null,
  created: Date.parse("2026-10-01T09:00:00Z"),
  modified: Date.parse("2026-10-01T10:00:00Z"),
  messageCount: 4,
  firstMessage: "List the open objectives",
};
const NEW: WorkbenchSessionListItem = {
  id: "workbench_session_NEW",
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

function mount() {
  return render(
    <MemoryRouter initialEntries={["/agents/swe%401/workbench"]}>
      <Routes>
        <Route path="/agents/:agentName/workbench" element={<SessionsScreen />} />
        <Route path="/agents/:agentName/workbench/:sessionId" element={<Opened />} />
      </Routes>
    </MemoryRouter>,
  );
}

function serve(items: readonly WorkbenchSessionListItem[], enablement = ENABLEMENT) {
  vi.mocked(workbenchApi.listWorkbenchSessions).mockResolvedValue(items);
  vi.mocked(workersApi.readAgent).mockResolvedValue(agent(enablement));
}

describe("SessionsScreen", () => {
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
      await screen.findByText("No sessions. Start the first one with New Session."),
    ).toBeTruthy();
  });

  it("reports a failed read with Retry", async () => {
    vi.mocked(workbenchApi.listWorkbenchSessions).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    vi.mocked(workersApi.readAgent).mockResolvedValue(agent(ENABLEMENT));
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("keeps New Session disabled while the agent has no enablement", async () => {
    serve([], null as unknown as AgentEnablement);
    mount();

    await screen.findByText("No sessions. Start the first one with New Session.");
    const button = screen.getByRole("button", { name: "New Session" });
    expect(button).toHaveAttribute("aria-disabled", "true");
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

    await screen.findByText("No sessions. Start the first one with New Session.");
    await userEvent.click(screen.getByRole("button", { name: "New Session" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("combobox", { name: "Agent Provider" })).toHaveTextContent(
      "atlas-llm",
    );
    expect(within(dialog).getByRole("textbox", { name: "Model Identifier" })).toHaveValue(
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

    await screen.findByText("No sessions. Start the first one with New Session.");
    await userEvent.click(screen.getByRole("button", { name: "New Session" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent Provider" }));
    await userEvent.click(await screen.findByRole("option", { name: "openai-org" }));
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Reasoning Effort" }));
    await userEvent.click(await screen.findByRole("option", { name: "high" }));
    const model = within(dialog).getByRole("textbox", { name: "Model Identifier" });
    await userEvent.clear(model);
    await userEvent.type(model, "gpt-5");
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    expect(workbenchApi.createWorkbenchSession).toHaveBeenCalledWith({
      agentName: "swe@1",
      agentProvider: "openai-org",
      modelIdentifier: "gpt-5",
      reasoningEffort: "high",
    });
  });

  it("shows the refusal of the server and keeps the dialog open", async () => {
    serve([]);
    vi.mocked(workbenchApi.createWorkbenchSession).mockRejectedValue(
      new ApiError("refused", "The model is unknown.", 422),
    );
    mount();

    await screen.findByText("No sessions. Start the first one with New Session.");
    await userEvent.click(screen.getByRole("button", { name: "New Session" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    expect(await within(dialog).findByText("The model is unknown.")).toBeTruthy();
  });

  it("closes the dialog on Cancel", async () => {
    serve([]);
    mount();

    await screen.findByText("No sessions. Start the first one with New Session.");
    await userEvent.click(screen.getByRole("button", { name: "New Session" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
