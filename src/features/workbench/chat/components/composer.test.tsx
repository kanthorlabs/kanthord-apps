import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { AgentEnablement, AgentModel, WorkbenchConfiguration } from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { ChatView } from "./chat-view";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const CONFIGURATION: WorkbenchConfiguration = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "low",
};

const MODELS: Readonly<Record<string, readonly AgentModel[]>> = {
  "atlas-llm": [
    { model_identifier: "qwen3-coder", reasoning_efforts: ["off", "low", "high"] },
    { model_identifier: "qwen3-next", reasoning_efforts: ["off", "low", "medium"] },
    { model_identifier: "glm-4.6", reasoning_efforts: ["off"] },
  ],
  "openai-org": [
    { model_identifier: "gpt-5", reasoning_efforts: ["off", "low", "high"] },
    { model_identifier: "gpt-5-mini", reasoning_efforts: ["off"] },
  ],
};

const ENABLEMENT: AgentEnablement = {
  agent_name: "swe@1",
  state: "enabled",
  agent_providers: [
    { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" },
    { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
  ],
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
  },
  revision: 2,
};

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

function mount() {
  return render(
    <ChatView
      session={{
        id: SESSION_ID,
        agent_name: "swe@1",
        configuration: CONFIGURATION,
        entries: [],
        run_active: false,
        resume_command: "pi --session ~/session.jsonl",
      }}
      enablement={ENABLEMENT}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(
    () => new Promise(() => undefined),
  );
  vi.mocked(workbenchApi.configureWorkbenchSession).mockImplementation(
    async (_sessionId, body) => body,
  );
  vi.mocked(workersApi.listAgentProviderModels).mockImplementation(
    async (_agentName, providerName) => MODELS[providerName] ?? [],
  );
});

function optionNames(): string[] {
  return screen.queryAllByRole("option").map((option) => option.textContent ?? "");
}

describe("Composer", () => {
  it("shows the configuration of the session in three pickers", () => {
    mount();

    expect(screen.getByRole("combobox", { name: "Agent Provider" })).toHaveTextContent("atlas-llm");
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent("qwen3-coder");
    expect(screen.getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent("low");
  });

  it("lists the models of the agent provider of the session", async () => {
    mount();

    await screen.findByRole("combobox", { name: "Model" });
    await waitFor(() =>
      expect(workersApi.listAgentProviderModels).toHaveBeenCalledWith("swe@1", "atlas-llm"),
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Model" }));

    await waitFor(() => expect(optionNames()).toEqual(["qwen3-coder", "qwen3-next", "glm-4.6"]));
  });

  it("lists the reasoning efforts of the model of the session", async () => {
    mount();

    await waitFor(() => expect(workersApi.listAgentProviderModels).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("combobox", { name: "Reasoning Effort" }));

    await waitFor(() => expect(optionNames()).toEqual(["off", "low", "high"]));
  });

  it("keeps the current configuration selectable while the list loads", async () => {
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(
      () => new Promise(() => undefined),
    );
    mount();

    await userEvent.click(screen.getByRole("combobox", { name: "Model" }));

    await screen.findAllByRole("option");
    expect(optionNames()).toEqual(["qwen3-coder"]);
  });

  it("shows a failed list inline and keeps the current configuration", async () => {
    vi.mocked(workersApi.listAgentProviderModels).mockRejectedValue(
      new ApiError("not_found", "The agent provider does not exist.", 404),
    );
    mount();

    expect(await screen.findByText("The agent provider does not exist.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent("qwen3-coder");
    expect(screen.getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent("low");
  });

  it("configures the whole session when the reasoning effort changes", async () => {
    mount();

    await choose("Reasoning Effort", "high");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      ...CONFIGURATION,
      reasoning_effort: "high",
    });
    expect(await screen.findByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent(
      "high",
    );
  });

  it("keeps the reasoning effort when the new model lists it", async () => {
    mount();
    await waitFor(() => expect(workersApi.listAgentProviderModels).toHaveBeenCalled());

    await choose("Model", "qwen3-next");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      ...CONFIGURATION,
      model_identifier: "qwen3-next",
    });
  });

  it("takes the first listed reasoning effort when the new model does not list the current one", async () => {
    mount();
    await waitFor(() => expect(workersApi.listAgentProviderModels).toHaveBeenCalled());

    await choose("Model", "glm-4.6");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      ...CONFIGURATION,
      model_identifier: "glm-4.6",
      reasoning_effort: "off",
    });
  });

  it("resets the model to the first listed model when the agent provider changes", async () => {
    mount();

    await choose("Agent Provider", "openai-org");

    expect(workersApi.listAgentProviderModels).toHaveBeenCalledWith("swe@1", "openai-org");
    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      agent_provider: "openai-org",
      model_identifier: "gpt-5",
      reasoning_effort: "low",
    });
  });

  it("resets the model to the first listed model even when the new agent provider lists the current one", async () => {
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(async (_agentName, name) =>
      name === "openai-org"
        ? [
            { model_identifier: "gpt-5", reasoning_efforts: ["off"] },
            { model_identifier: "qwen3-coder", reasoning_efforts: ["medium", "high"] },
          ]
        : (MODELS[name] ?? []),
    );
    mount();

    await choose("Agent Provider", "openai-org");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      agent_provider: "openai-org",
      model_identifier: "gpt-5",
      reasoning_effort: "off",
    });
  });

  it("changes nothing when the list of the new agent provider fails", async () => {
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(async (_agentName, name) => {
      if (name === "openai-org") {
        throw new ApiError("not_found", "The agent provider does not exist.", 404);
      }
      return MODELS[name] ?? [];
    });
    mount();

    await choose("Agent Provider", "openai-org");

    expect(await screen.findByText("The agent provider does not exist.")).toBeTruthy();
    expect(workbenchApi.configureWorkbenchSession).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Agent Provider" })).toHaveTextContent("atlas-llm");
  });

  it("sends no request when the human picks the value that the session holds", async () => {
    mount();

    await choose("Reasoning Effort", "low");

    expect(workbenchApi.configureWorkbenchSession).not.toHaveBeenCalled();
  });

  it("names the refusal and keeps the previous value", async () => {
    vi.mocked(workbenchApi.configureWorkbenchSession).mockRejectedValue(
      new ApiError("refused", "The model does not support the reasoning effort.", 422),
    );
    mount();

    await choose("Reasoning Effort", "high");

    expect(
      await screen.findByText("The model does not support the reasoning effort."),
    ).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent("low");
  });

  it("sends the message with Enter and keeps a new line for Shift+Enter", async () => {
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
      session_id: SESSION_ID,
      run_active: true,
    });
    mount();

    const box = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(box, "first{Shift>}{Enter}{/Shift}second");
    expect(box).toHaveValue("first\nsecond");
    await userEvent.type(box, "{Enter}");

    expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(SESSION_ID, "first\nsecond");
  });

  it("keeps Send disabled for an empty message", () => {
    mount();

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
