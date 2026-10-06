import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import type { AgentEnablement, WorkbenchConfiguration } from "@/api/types";

vi.mock("@/api/resources/workbench");

import { ChatView } from "./chat-view";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const CONFIGURATION: WorkbenchConfiguration = {
  agentProvider: "atlas-llm",
  modelIdentifier: "gpt-5",
  reasoningEffort: "off",
};

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

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

function mount() {
  return render(
    <ChatView
      session={{
        id: SESSION_ID,
        agentName: "swe@1",
        configuration: CONFIGURATION,
        entries: [],
        runActive: false,
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
});

describe("Composer", () => {
  it("shows the configuration of the session in three pickers", () => {
    mount();

    expect(screen.getByRole("combobox", { name: "Agent Provider" })).toHaveTextContent("atlas-llm");
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent("gpt-5");
    expect(screen.getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent("off");
  });

  it("configures the whole session when the reasoning effort changes", async () => {
    mount();

    await choose("Reasoning Effort", "high");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      ...CONFIGURATION,
      reasoningEffort: "high",
    });
    expect(await screen.findByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent(
      "high",
    );
  });

  it("configures the whole session when the model changes", async () => {
    mount();

    await choose("Model", "qwen3-coder");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      ...CONFIGURATION,
      modelIdentifier: "qwen3-coder",
    });
  });

  it("configures the whole session when the agent provider changes", async () => {
    mount();

    await choose("Agent Provider", "openai-org");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      ...CONFIGURATION,
      agentProvider: "openai-org",
    });
  });

  it("sends no request when the human picks the value that the session holds", async () => {
    mount();

    await choose("Reasoning Effort", "off");

    expect(workbenchApi.configureWorkbenchSession).not.toHaveBeenCalled();
  });

  it("names the refusal and keeps the previous value", async () => {
    vi.mocked(workbenchApi.configureWorkbenchSession).mockRejectedValue(
      new ApiError("refused", "The model does not support the reasoning effort.", 422),
    );
    mount();

    await choose("Reasoning Effort", "max");

    expect(
      await screen.findByText("The model does not support the reasoning effort."),
    ).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Reasoning Effort" })).toHaveTextContent("off");
  });

  it("sends the message with Enter and keeps a new line for Shift+Enter", async () => {
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
      sessionId: SESSION_ID,
      runActive: true,
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
