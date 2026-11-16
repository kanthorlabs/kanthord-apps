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
  AgentSummary,
  WorkbenchConfiguration,
  WorkbenchMember,
  WorkbenchMessageAnswer,
  WorkbenchQueuedMessage,
  WorkbenchSessionEntry,
} from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { ChatView } from "./chat-view";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";
const HOST_MEMBER = { session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" };

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

const RE_ENABLEMENT: AgentEnablement = {
  ...ENABLEMENT,
  agent_name: "re@1",
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-next",
    reasoning_effort: "off",
  },
};

function summary(
  agentName: string,
  displayName: string,
  enablement: AgentEnablement | null,
  consumers: AgentSummary["consumers"],
): AgentSummary {
  return {
    agentName,
    displayName,
    workerNames: [],
    consumers,
    toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 },
    enablement,
  };
}

const AGENTS: readonly AgentSummary[] = [
  summary("ops@1", "Yumi", null, ["workbench"]),
  summary("re@1", "RE", RE_ENABLEMENT, ["workbench", "worker"]),
  summary("swe@1", "SWE", ENABLEMENT, ["workbench", "worker"]),
  summary("guard@1", "Guard", ENABLEMENT, []),
  summary("sa@1", "Software Architecture", { ...ENABLEMENT, agent_name: "sa@1" }, ["workbench"]),
];

const GUEST_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0RE1";
const GUEST_MEMBER: WorkbenchMember = {
  session_id: GUEST_ID,
  agent_name: "re@1",
  display_name: "RE",
};

function answer(member: WorkbenchMember, id: string, stopReason = "stop"): WorkbenchSessionEntry {
  return {
    session_id: member.session_id,
    agent_name: member.agent_name,
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    message: {
      role: "assistant",
      content: [{ type: "text", text: `Answer ${id}` }],
      stopReason,
    },
  };
}

function planEntry(member: WorkbenchMember, id: string): WorkbenchSessionEntry {
  return {
    session_id: member.session_id,
    agent_name: member.agent_name,
    type: "custom_message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    customType: "kanthord.workbench.plan",
    content: "## Plan",
    display: true,
    details: { phases: [], unresolved: null },
  };
}

function mount(
  agentName = "swe@1",
  runActive = false,
  conversation: {
    readonly members?: readonly WorkbenchMember[];
    readonly entries?: readonly WorkbenchSessionEntry[];
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={[`/workbench/${SESSION_ID}`]}>
      <Where />
      <ChatView
        session={{
          id: SESSION_ID,
          agent_name: agentName,
          configuration: CONFIGURATION,
          entries: conversation.entries ?? [],
          members: conversation.members ?? [HOST_MEMBER],
          run_active: runActive,
          forked_from: null,
          resume_command: "pi --session ~/session.jsonl",
        }}
        enablement={ENABLEMENT}
        ownerName="Ulrich"
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
  vi.mocked(workersApi.listAgents).mockResolvedValue(AGENTS);
  vi.mocked(workersApi.listAgentProviderModels).mockImplementation(
    async (_agentName, providerName) => MODELS[providerName] ?? [],
  );
});

function optionNames(): string[] {
  return screen.queryAllByRole("option").map((option) => option.textContent ?? "");
}

describe("Composer mentions", () => {
  async function typeInMessage(text: string) {
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());
    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), text);
  }

  it("lists the enabled session agents by display name after an @ at the start", async () => {
    mount();

    await typeInMessage("@");

    const list = await screen.findByRole("listbox", { name: "Mentions" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["RE", "SWE", "Software Architecture"]);
    expect(within(list).queryByText("Guard")).toBeNull();
  });

  it("filters by the typed prefix and inserts the full display name with a space", async () => {
    mount();

    await typeInMessage("@r");
    const list = await screen.findByRole("listbox", { name: "Mentions" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["RE"]);
    await userEvent.click(within(list).getByRole("option", { name: "RE" }));

    expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("@RE ");
    expect(screen.queryByRole("listbox", { name: "Mentions" })).toBeNull();
  });

  it("inserts the active suggestion on Enter without sending", async () => {
    mount();

    await typeInMessage("@swe");
    await screen.findByRole("listbox", { name: "Mentions" });
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("@SWE ");
    expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
  });

  it("makes the first match active and inserts it on Enter without sending", async () => {
    mount();

    await typeInMessage("@R");
    await screen.findByRole("listbox", { name: "Mentions" });
    await userEvent.keyboard("{Enter}");

    expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("@RE ");
    expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
  });

  it("inserts the active suggestion on Tab", async () => {
    mount();

    await typeInMessage("@S");
    await screen.findByRole("listbox", { name: "Mentions" });
    await userEvent.keyboard("{ArrowDown}{Tab}");

    expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue(
      "@Software Architecture ",
    );
    expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
  });

  it("names one existing option as the active descendant for a space-separated name", async () => {
    mount();

    await typeInMessage("@S");
    const list = await screen.findByRole("listbox", { name: "Mentions" });
    const box = screen.getByRole("combobox", { name: "Message" });
    const options = within(list).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["SWE", "Software Architecture"]);
    expect(box.getAttribute("aria-activedescendant")).toBe(options[0]?.id);

    await userEvent.keyboard("{ArrowDown}");

    const active = box.getAttribute("aria-activedescendant") ?? "";
    expect(active).toBe(options[1]?.id);
    expect(active).not.toMatch(/\s/);
    expect(document.querySelectorAll(`[id="${active}"]`)).toHaveLength(1);
  });

  it("opens no list for an @ later in the draft", async () => {
    mount();

    await typeInMessage("hello @");

    expect(screen.queryByRole("listbox", { name: "Mentions" })).toBeNull();
  });
});

describe("Composer addressee", () => {
  const BOTH = [HOST_MEMBER, GUEST_MEMBER];

  it("shows the host for the greeting", () => {
    mount("swe@1", false, { members: BOTH, entries: [answer(HOST_MEMBER, "e1")] });

    expect(screen.getByLabelText("Addressee")).toHaveTextContent("SWE");
  });

  it("shows the last responder when a guest answered after the host", () => {
    mount("swe@1", false, {
      members: BOTH,
      entries: [answer(HOST_MEMBER, "e1"), answer(GUEST_MEMBER, "e2")],
    });

    expect(screen.getByLabelText("Addressee")).toHaveTextContent("RE");
  });

  it("shows the target of a leading mention in the draft over the last responder", async () => {
    mount("swe@1", false, {
      members: BOTH,
      entries: [answer(HOST_MEMBER, "e1"), answer(GUEST_MEMBER, "e2")],
    });
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "@SWE look");

    expect(screen.getByLabelText("Addressee")).toHaveTextContent("SWE");
  });

  it.each([
    ["@RE, why", "RE"],
    ["@RE{Shift>}{Enter}{/Shift}", "RE"],
    ["@re look", "RE"],
    ["@Software Architecture plan", "Software Architecture"],
  ])("routes the draft %s to %s", async (draft, target) => {
    mount("swe@1", false, { entries: [answer(HOST_MEMBER, "e1")] });
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), draft);

    expect(screen.getByLabelText("Addressee")).toHaveTextContent(new RegExp(`^To @${target}$`));
  });

  it("does not route a name that continues with a name character", async () => {
    mount("swe@1", false, { entries: [answer(HOST_MEMBER, "e1")] });
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "@REX look");

    expect(screen.getByLabelText("Addressee")).toHaveTextContent(/^To @SWE \(last answer\)$/);
  });

  it("labels the last responder with the last answer", () => {
    mount("swe@1", false, {
      members: BOTH,
      entries: [answer(HOST_MEMBER, "e1"), answer(GUEST_MEMBER, "e2")],
    });

    expect(screen.getByLabelText("Addressee")).toHaveTextContent(/^To @RE \(last answer\)$/);
  });

  it("counts only final answers for the last responder", () => {
    mount("swe@1", false, {
      members: BOTH,
      entries: [answer(HOST_MEMBER, "e1"), answer(GUEST_MEMBER, "e2", "aborted")],
    });

    expect(screen.getByLabelText("Addressee")).toHaveTextContent(/^To @SWE \(last answer\)$/);
  });

  it("labels Jeremy with the last answer after a plan entry", () => {
    const jeremy = { session_id: GUEST_ID, agent_name: "plan@1", display_name: "Jeremy" };
    mount("swe@1", false, {
      members: [HOST_MEMBER, jeremy],
      entries: [answer(HOST_MEMBER, "e1"), planEntry(jeremy, "e2")],
    });

    expect(screen.getByLabelText("Addressee")).toHaveTextContent(/^To @Jeremy \(last answer\)$/);
  });

  it("counts no entry with a phase field as a final answer", () => {
    const jeremy = { session_id: GUEST_ID, agent_name: "plan@1", display_name: "Jeremy" };
    const phaseSession = { ...jeremy, session_id: `${GUEST_ID}-phase` };
    mount("swe@1", false, {
      members: [HOST_MEMBER, jeremy],
      entries: [answer(jeremy, "e1"), { ...answer(phaseSession, "e2"), phase: "reviewer" }],
    });

    expect(screen.getByLabelText("Addressee")).toHaveTextContent(/^To @Jeremy \(last answer\)$/);
  });

  it("shows the addressee below the input", () => {
    mount("swe@1", false, { entries: [answer(HOST_MEMBER, "e1")] });

    const input = screen.getByRole("combobox", { name: "Message" });
    const chip = screen.getByLabelText("Addressee");
    expect(input.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the matched display name of an agent that is not yet a member and disables the pickers", async () => {
    mount("swe@1", false, { entries: [answer(HOST_MEMBER, "e1")] });
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "@RE look");

    expect(screen.getByLabelText("Addressee")).toHaveTextContent("RE");
    expect(await screen.findByRole("combobox", { name: "Model" })).toBeDisabled();
  });

  it("shows a queued tagged message as to its mention before the next poll", async () => {
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
      session_id: SESSION_ID,
      agent_name: "swe@1",
      run_active: true,
      queued_message_id: "queued_1",
      cleared: [],
    });
    mount("swe@1", true, { members: BOTH, entries: [answer(HOST_MEMBER, "e1")] });
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "@RE look{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: /1 queued/ }));

    expect(await screen.findByText("to @RE")).toBeTruthy();
  });

  it("shows a queued untagged message as to last answer", async () => {
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
      session_id: SESSION_ID,
      agent_name: "swe@1",
      run_active: true,
      queued_message_id: "queued_1",
      cleared: [],
    });
    mount("swe@1", true, { members: BOTH, entries: [answer(HOST_MEMBER, "e1")] });
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "look{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: /1 queued/ }));

    expect(await screen.findByText("to last answer")).toBeTruthy();
  });

  it("configures the session id of the addressee member", async () => {
    mount("swe@1", false, { members: BOTH, entries: [answer(HOST_MEMBER, "e1")] });
    await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());
    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "@RE look");

    await waitFor(() =>
      expect(workersApi.listAgentProviderModels).toHaveBeenCalledWith("re@1", "atlas-llm"),
    );
    await choose("Reasoning Effort", "low");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(GUEST_ID, {
      agent_provider: "atlas-llm",
      model_identifier: "qwen3-next",
      reasoning_effort: "low",
    });
  });

  it("configures the host session while the addressee is the host", async () => {
    mount("swe@1", false, { members: BOTH, entries: [answer(HOST_MEMBER, "e1")] });
    await waitFor(() => expect(workersApi.listAgentProviderModels).toHaveBeenCalled());

    await choose("Reasoning Effort", "high");

    expect(workbenchApi.configureWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
      ...CONFIGURATION,
      reasoning_effort: "high",
    });
  });
});

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
      agent_name: null,
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
      agent_name: null,
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

    it("shows Stop on the run line and not in the composer", () => {
      mount("swe@1", true);

      const composerForm = screen.getByRole("form", { name: "Composer" });
      expect(within(composerForm).queryByRole("button", { name: "Stop" })).toBeNull();
      expect(
        within(screen.getByRole("group", { name: "Run line" })).getByRole("button", {
          name: "Stop",
        }),
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    });

    it("disables the three pickers", () => {
      mount("swe@1", true);

      for (const name of ["Agent Provider", "Model", "Reasoning Effort"]) {
        expect(screen.getByRole("combobox", { name })).toBeDisabled();
      }
    });

    it("forks on /new with text and leaves the hint line empty", async () => {
      vi.mocked(workbenchApi.forkWorkbenchSession).mockReturnValue(new Promise(() => undefined));
      mount("swe@1", true);

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "/new x");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(workbenchApi.forkWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
        text: "x",
        signal: expect.any(AbortSignal),
      });
      expect(
        within(screen.getByRole("form", { name: "Composer" })).getByRole("status"),
      ).toHaveTextContent("");
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    });
  });

  it("disables the three pickers while the queue holds a message and no run is active", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents).mockResolvedValueOnce({
      entries: [],
      members: [HOST_MEMBER],
      snapshot: {
        streaming_message: null,
        pending_tool_calls: [],
        pending_approval: null,
        queue: [{ id: "queued_1", text: "later", agent_name: null, display_name: null }],
        run_active: false,
        error_message: null,
        auto_mode: true,
        phase: null,
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

  it("puts the cleared texts before the current draft, joined by one newline", async () => {
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
      agent_name: null,
      run_active: true,
      queued_message_id: null,
      cleared: [
        { id: "queued_1", text: "first", agent_name: null, display_name: null },
        { id: "queued_2", text: "second", agent_name: null, display_name: null },
      ],
    });

    await waitFor(() => expect(box).toHaveValue("first\nsecond\nlater"));
  });

  describe("Stop", () => {
    const QUEUE = [
      { id: "queued_1", text: "first queued", agent_name: null, display_name: null },
      { id: "queued_2", text: "second queued", agent_name: null, display_name: null },
    ];

    function withQueue(queue: readonly WorkbenchQueuedMessage[]) {
      vi.mocked(workbenchApi.readWorkbenchEvents).mockResolvedValueOnce({
        entries: [],
        members: [HOST_MEMBER],
        snapshot: {
          streaming_message: null,
          pending_tool_calls: [],
          pending_approval: null,
          queue,
          run_active: true,
          error_message: null,
          auto_mode: true,
          phase: null,
        },
        version: 1,
      });
      mount("swe@1", true);
    }

    async function clickStop() {
      const runLine = screen.getByRole("group", { name: "Run line" });
      await userEvent.click(within(runLine).getByRole("button", { name: "Stop" }));
    }

    const box = () => screen.getByRole("combobox", { name: "Message" });

    it("sends abort with no confirm when the queue is empty", async () => {
      vi.mocked(workbenchApi.abortWorkbenchRun).mockResolvedValue({
        session_id: SESSION_ID,
        run_active: false,
        cleared: [],
      });
      mount("swe@1", true);

      await clickStop();

      expect(workbenchApi.abortWorkbenchRun).toHaveBeenCalledWith(SESSION_ID);
      expect(screen.queryByRole("alertdialog")).toBeNull();
      await waitFor(() => expect(screen.queryByRole("group", { name: "Run line" })).toBeNull());
    });

    it("shows the confirm with the count when the queue holds messages", async () => {
      withQueue(QUEUE);
      await screen.findByRole("button", { name: /2 queued/ });

      await clickStop();

      const confirm = screen.getByRole("alertdialog");
      expect(within(confirm).getByText("Stop the run and clear 2 queued?")).toBeInTheDocument();
      expect(
        within(confirm).getByText("Your 2 queued messages return to the composer."),
      ).toBeInTheDocument();
      expect(within(confirm).queryByText("Your draft sends next.")).toBeNull();
      expect(within(confirm).queryByRole("button", { name: "Stop & send draft" })).toBeNull();
      expect(workbenchApi.abortWorkbenchRun).not.toHaveBeenCalled();
    });

    it("says message in the singular and adds the draft line with a draft", async () => {
      withQueue([QUEUE[0]!]);
      await screen.findByRole("button", { name: /1 queued/ });
      await userEvent.type(box(), "my draft");

      await clickStop();

      const confirm = screen.getByRole("alertdialog");
      expect(
        within(confirm).getByText("Your 1 queued message returns to the composer."),
      ).toBeInTheDocument();
      expect(within(confirm).getByText("Your draft sends next.")).toBeInTheDocument();
      expect(within(confirm).getByRole("button", { name: "Stop & send draft" })).toBeEnabled();
      expect(within(confirm).queryByRole("button", { name: "Stop" })).toBeNull();
    });

    it("hides Stop & send draft and the draft line when the draft is a /new command", async () => {
      withQueue(QUEUE);
      await screen.findByRole("button", { name: /2 queued/ });
      await userEvent.type(box(), "/new");
      await userEvent.keyboard("{Escape}");
      await clickStop();

      const confirm = screen.getByRole("alertdialog");
      expect(within(confirm).queryByRole("button", { name: "Stop & send draft" })).toBeNull();
      expect(within(confirm).queryByText("Your draft sends next.")).toBeNull();
      expect(within(confirm).getByRole("button", { name: "Stop" })).toBeEnabled();
    });

    it("keeps the run, the queue and the draft on Cancel", async () => {
      withQueue(QUEUE);
      await screen.findByRole("button", { name: /2 queued/ });
      await userEvent.type(box(), "my draft");
      await clickStop();

      await userEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
      );

      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(workbenchApi.abortWorkbenchRun).not.toHaveBeenCalled();
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
      expect(screen.getByRole("group", { name: "Run line" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /2 queued/ })).toBeInTheDocument();
      expect(box()).toHaveValue("my draft");
    });

    it("aborts, empties the queue list and refills the cleared texts before the draft", async () => {
      vi.mocked(workbenchApi.abortWorkbenchRun).mockResolvedValue({
        session_id: SESSION_ID,
        run_active: false,
        cleared: QUEUE,
      });
      withQueue(QUEUE);
      await screen.findByRole("button", { name: /2 queued/ });
      await userEvent.type(box(), "/new");
      await userEvent.keyboard("{Escape}");
      await clickStop();

      await userEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Stop" }),
      );

      expect(workbenchApi.abortWorkbenchRun).toHaveBeenCalledWith(SESSION_ID);
      await waitFor(() => expect(screen.queryByRole("button", { name: /queued/ })).toBeNull());
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(box()).toHaveValue("first queued\nsecond queued\n/new");
    });

    it("says in the hint line that the cleared messages are back and drops it on the next edit", async () => {
      vi.mocked(workbenchApi.abortWorkbenchRun).mockResolvedValue({
        session_id: SESSION_ID,
        run_active: false,
        cleared: QUEUE,
      });
      withQueue(QUEUE);
      await screen.findByRole("button", { name: /2 queued/ });
      await clickStop();

      await userEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Stop" }),
      );

      const hint = await screen.findByText("2 cleared messages are back in your draft");
      expect(hint).toHaveAttribute("role", "status");
      await userEvent.type(box(), "!");
      expect(screen.queryByText("2 cleared messages are back in your draft")).toBeNull();
    });

    it("says message in the singular when one cleared message is back", async () => {
      vi.mocked(workbenchApi.abortWorkbenchRun).mockResolvedValue({
        session_id: SESSION_ID,
        run_active: false,
        cleared: [QUEUE[0]!],
      });
      withQueue([QUEUE[0]!]);
      await screen.findByRole("button", { name: /1 queued/ });

      await clickStop();
      await userEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Stop" }),
      );

      expect(
        await screen.findByText("1 cleared message is back in your draft"),
      ).toBeInTheDocument();
    });

    it("sends the draft with replace and leaves only the draft in the queue list", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        session_id: SESSION_ID,
        agent_name: null,
        run_active: true,
        queued_message_id: "queued_9",
        cleared: QUEUE,
      });
      withQueue(QUEUE);
      await screen.findByRole("button", { name: /2 queued/ });
      await userEvent.type(box(), "my draft");
      await clickStop();

      await userEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Stop & send draft" }),
      );

      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(
        SESSION_ID,
        "my draft",
        "replace",
      );
      const line = await screen.findByRole("button", { name: /1 queued/ });
      expect(line).toHaveTextContent("my draft");
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(box()).toHaveValue("first queued\nsecond queued");
    });
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
      agent_name: null,
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

    it("keeps the list closed after a send and opens it on a typed slash and on a new focus", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(SENT);
      mount("ops@1");
      await userEvent.type(box(), "hello{Enter}");

      await waitFor(() => expect(box()).toHaveValue(""));
      expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();

      await userEvent.type(box(), "/");
      expect(await screen.findByRole("listbox", { name: "Commands" })).toBeInTheDocument();
      await userEvent.clear(box());
      await userEvent.tab();
      await userEvent.click(box());
      expect(await screen.findByRole("listbox", { name: "Commands" })).toBeInTheDocument();
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
      expect(screen.getByRole("option", { name: /\/new/ })).toHaveTextContent(
        /Start a new chat\. With text, .+'s model summarizes this chat with your text as the instruction, and Guard checks the summary\. Mention an agent to continue with it\./,
      );
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

    it("forks and sends no message on /new with text", async () => {
      vi.mocked(workbenchApi.forkWorkbenchSession).mockReturnValue(new Promise(() => undefined));
      mount("swe@1");

      await userEvent.type(box(), "/new x");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(workbenchApi.forkWorkbenchSession).toHaveBeenCalledTimes(1);
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
