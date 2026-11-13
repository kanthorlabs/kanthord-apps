import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentEnablement,
  AgentModel,
  WorkbenchConfiguration,
  WorkbenchMessageAnswer,
} from "@/api/types";

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
  fallback_configurations: [],
  revision: 2,
};

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

function Where() {
  const { pathname, search } = useLocation();
  return <output aria-label="Location">{`${pathname}${search}`}</output>;
}

function mount(agentName = "swe@1", runActive = false) {
  return render(
    <MemoryRouter initialEntries={[`/workbench/${SESSION_ID}`]}>
      <Where />
      <ChatView
        session={{
          id: SESSION_ID,
          agent_name: agentName,
          configuration: CONFIGURATION,
          entries: [],
          run_active: runActive,
          resume_command: "pi --session ~/session.jsonl",
        }}
        enablement={ENABLEMENT}
        ownerName="Ulrich"
        agentDisplayName="SWE"
      />
    </MemoryRouter>,
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
      queued_message_id: null,
      cleared: [],
    });
    mount();

    const box = screen.getByRole("combobox", { name: "Message" });
    await userEvent.type(box, "first{Shift>}{Enter}{/Shift}second");
    expect(box).toHaveValue("first\nsecond");
    await userEvent.type(box, "{Enter}");

    expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(
      SESSION_ID,
      "first\nsecond",
      "queue",
    );
  });

  describe("during a run", () => {
    const ACCEPTED = {
      session_id: SESSION_ID,
      run_active: true,
      queued_message_id: "queued_1",
      cleared: [],
    } as const;

    it("queues the message with Enter", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(ACCEPTED);
      mount("swe@1", true);

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "next{Enter}");

      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(SESSION_ID, "next", "queue");
    });

    it("queues the message with the Send button", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(ACCEPTED);
      mount("swe@1", true);

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "next");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(SESSION_ID, "next", "queue");
    });

    it("shows no Stop button", () => {
      mount("swe@1", true);

      expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    });

    it("disables the three pickers", () => {
      mount("swe@1", true);

      for (const name of ["Agent Provider", "Model", "Reasoning Effort"]) {
        expect(screen.getByRole("combobox", { name })).toBeDisabled();
      }
    });

    it("shows the slash hint and no state text on the hint line", async () => {
      mount("swe@1", true);

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "/new x");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      const hint = screen.getByText("/new takes no text yet");
      expect(hint).toHaveAttribute("role", "status");
      expect(hint.textContent).toBe("/new takes no text yet");
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    });
  });

  it("disables the three pickers while the queue holds a message and no run is active", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents).mockResolvedValueOnce({
      entries: [],
      snapshot: {
        streaming_message: null,
        pending_tool_calls: [],
        pending_approval: null,
        queue: [{ id: "queued_1", text: "later" }],
        run_active: false,
        error_message: null,
      },
      version: 1,
    });
    mount();

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Model" })).toBeDisabled());
    expect(screen.getByRole("combobox", { name: "Agent Provider" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Reasoning Effort" })).toBeDisabled();
  });

  it("names the agent in the idle placeholder and the run in the running placeholder", () => {
    const idle = mount();
    expect(screen.getByRole("combobox", { name: "Message" })).toHaveAttribute(
      "placeholder",
      "Message SWE · / for commands",
    );
    idle.unmount();

    mount("swe@1", true);
    expect(screen.getByRole("combobox", { name: "Message" })).toHaveAttribute(
      "placeholder",
      "Message · sends after this run",
    );
  });

  it("puts the cleared texts before the current draft, joined by a blank line", async () => {
    let answer: (value: WorkbenchMessageAnswer) => void = () => undefined;
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    mount("swe@1", true);
    const box = screen.getByRole("combobox", { name: "Message" });
    await userEvent.type(box, "sent{Enter}");
    await userEvent.type(box, "later");

    answer({
      session_id: SESSION_ID,
      run_active: true,
      queued_message_id: null,
      cleared: [
        { id: "queued_1", text: "first" },
        { id: "queued_2", text: "second" },
      ],
    });

    await waitFor(() => expect(box).toHaveValue("first\n\nsecond\n\nlater"));
  });

  it("keeps Send disabled for an empty message", () => {
    mount();

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  describe("slash commands", () => {
    const BRIEF_TEXT = "Report the system status and the actions that need me.";
    const HEALTH_TEXT = "Check the health of the gateway and the providers.";
    const SENT = {
      session_id: SESSION_ID,
      run_active: true,
      queued_message_id: null,
      cleared: [],
    } as const;

    function box() {
      return screen.getByRole("combobox", { name: "Message" });
    }

    function commandNames(): string[] {
      return screen
        .getAllByRole("option")
        .map((option) => within(option).getByText(/^\/\w+$/).textContent ?? "");
    }

    it("opens the command list on focus of the empty composer and closes it on Esc", async () => {
      mount("ops@1");
      expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();

      await userEvent.click(box());

      expect(await screen.findByRole("listbox", { name: "Commands" })).toBeInTheDocument();
      expect(box()).toHaveAttribute("aria-expanded", "true");
      expect(box()).toHaveAttribute(
        "aria-controls",
        screen.getByRole("listbox", { name: "Commands" }).id,
      );
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
    });

    it("opens the command list when the draft starts with a slash and closes it on blur", async () => {
      mount("ops@1");

      await userEvent.type(box(), "/");

      expect(await screen.findByRole("listbox", { name: "Commands" })).toBeInTheDocument();
      await userEvent.tab();
      expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
    });

    it("closes the list when the draft no longer matches", async () => {
      mount("ops@1");

      await userEvent.type(box(), "/brief now");

      expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
    });

    it("shows the name and the description of each command", async () => {
      mount("ops@1");
      await userEvent.click(box());

      expect(await screen.findByRole("option", { name: /\/brief/ })).toHaveTextContent(
        "Report status and the actions that need you",
      );
      expect(screen.getByRole("option", { name: /\/health/ })).toHaveTextContent(
        "Check provider health (slow probe)",
      );
      expect(screen.getByRole("option", { name: /\/new/ })).toHaveTextContent("New conversation");
    });

    it("lists /brief, /health and /new in an ops@1 conversation", async () => {
      mount("ops@1");
      await userEvent.click(box());

      await screen.findByRole("listbox", { name: "Commands" });
      expect(screen.getAllByRole("option")).toHaveLength(3);
      expect(commandNames()).toEqual(["/brief", "/health", "/new"]);
    });

    it("lists only /new in a swe@1 conversation", async () => {
      mount("swe@1");
      await userEvent.click(box());

      await screen.findByRole("listbox", { name: "Commands" });
      expect(commandNames()).toEqual(["/new"]);
    });

    it("sends the fixed text of /brief once after ArrowDown and Enter", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(SENT);
      mount("ops@1");
      await userEvent.click(box());
      await screen.findByRole("listbox", { name: "Commands" });

      await userEvent.keyboard("{ArrowDown}{Enter}");

      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledTimes(1);
      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(
        SESSION_ID,
        BRIEF_TEXT,
        "queue",
      );
    });

    it("sends the fixed text of /health once on a click", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(SENT);
      mount("ops@1");
      await userEvent.click(box());

      await userEvent.click(await screen.findByRole("option", { name: /\/health/ }));

      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledTimes(1);
      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(
        SESSION_ID,
        HEALTH_TEXT,
        "queue",
      );
    });

    it("sends the fixed text of the typed /health once", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(SENT);
      mount("ops@1");

      await userEvent.type(box(), "/health");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledTimes(1);
      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(
        SESSION_ID,
        HEALTH_TEXT,
        "queue",
      );
    });

    it("sends the typed /brief as plain text in a swe@1 conversation", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(SENT);
      mount("swe@1");

      await userEvent.type(box(), "/brief");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(SESSION_ID, "/brief", "queue");
    });

    it("opens the new-session route with the agent and the configuration on /new alone", async () => {
      mount("swe@1");

      await userEvent.type(box(), "/new");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByRole("status", { name: "Location" })).toHaveTextContent(
        `/workbench/new?${new URLSearchParams({
          agent_name: "swe@1",
          agent_provider: CONFIGURATION.agent_provider,
          model_identifier: CONFIGURATION.model_identifier,
          reasoning_effort: CONFIGURATION.reasoning_effort,
        })}`,
      );
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
    });

    it("opens the new-session route when the human picks /new", async () => {
      mount("swe@1");
      await userEvent.click(box());

      await userEvent.click(await screen.findByRole("option", { name: /\/new/ }));

      expect(screen.getByRole("status", { name: "Location" })).toHaveTextContent(
        "/workbench/new?agent_name=swe%401",
      );
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    });

    it("shows the hint and sends nothing on /new with text", async () => {
      mount("swe@1");

      await userEvent.type(box(), "/new x");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("/new takes no text yet")).toBeInTheDocument();
      expect(box()).toHaveValue("/new x");
      expect(screen.getByRole("status", { name: "Location" })).toHaveTextContent(
        `/workbench/${SESSION_ID}`,
      );
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
    });

    it("shows no list on focus while a send is in flight", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockReturnValue(new Promise(() => undefined));
      mount("ops@1");
      await userEvent.type(box(), "hello{Enter}");

      await userEvent.type(box(), "/");

      expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
    });
  });
});
