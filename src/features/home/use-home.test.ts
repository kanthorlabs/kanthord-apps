import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/workbench", () => ({
  listWorkbenchSessions: vi.fn(),
}));

vi.mock("@/api/resources/workers", () => ({
  listAgents: vi.fn(),
}));

import { listWorkbenchSessions } from "@/api/resources/workbench";
import { listAgents } from "@/api/resources/workers";
import type { AgentEnablement, AgentSummary, WorkbenchSessionListItem } from "@/api/types";

import { useHome, yumiConfigurationOf } from "./use-home";

const CONFIGURATION = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
} as const;

function enablement(
  overrides: Partial<AgentEnablement["default_configuration"]> = {},
  state: AgentEnablement["state"] = "enabled",
): AgentEnablement {
  return {
    agent_name: "ops@1",
    state,
    agent_providers: [
      { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" },
    ],
    default_configuration: { ...CONFIGURATION, ...overrides },
    fallback_configurations: [],
    revision: 1,
  };
}

function yumi(held: AgentEnablement | null): AgentSummary {
  return {
    agentName: "ops@1",
    displayName: "Yumi",
    workerNames: [],
    consumers: ["workbench"],
    toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 3 },
    enablement: held,
  };
}

function item(id: string, patch: Partial<WorkbenchSessionListItem> = {}): WorkbenchSessionListItem {
  return {
    id,
    agent_name: "ops@1",
    name: null,
    created: 1,
    modified: 1,
    message_count: 2,
    first_message: "What needs me?",
    run_active: false,
    pending_approval: null,
    ...patch,
  };
}

function serve(held: AgentEnablement | null, sessions: readonly WorkbenchSessionListItem[] = []) {
  vi.mocked(listAgents).mockResolvedValue([yumi(held)]);
  vi.mocked(listWorkbenchSessions).mockResolvedValue(sessions);
}

async function ready() {
  const hook = renderHook(() => useHome(true));
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useHome", () => {
  it("opens the newest ops@1 item by modified", async () => {
    serve(enablement(), [
      item("old", { modified: 10 }),
      item("newest", { modified: 30 }),
      item("middle", { modified: 20 }),
    ]);

    const { result } = await ready();

    expect(listWorkbenchSessions).toHaveBeenCalledWith("ops@1");
    expect(result.current.view).toEqual({ kind: "session", sessionId: "newest", failure: null });
    expect(result.current.sessionId).toBe("newest");
  });

  it("skips a case conversation", async () => {
    serve(enablement(), [
      item("case", { modified: 30, first_message: "Case: node `n` (Blocked). Explain." }),
      item("general", { modified: 10 }),
    ]);

    const { result } = await ready();

    expect(result.current.sessionId).toBe("general");
  });

  it("skips an item with an empty first message", async () => {
    serve(enablement(), [
      item("empty", { modified: 30, first_message: "" }),
      item("general", { modified: 10 }),
    ]);

    const { result } = await ready();

    expect(result.current.sessionId).toBe("general");
  });

  it("opens in new-session mode with no ops@1 item", async () => {
    serve(enablement(), [
      item("case", { first_message: "Case: x" }),
      item("empty", { first_message: "" }),
    ]);

    const { result } = await ready();

    expect(result.current.view).toEqual({ kind: "new" });
    expect(result.current.sessionId).toBeNull();
  });

  it("reports the missing Yumi configuration", async () => {
    serve(enablement({ agent_provider: "" }));

    const { result } = await ready();

    expect(result.current.configuration.ok).toBe(false);
    expect(result.current.configurationError).toBe(
      "The default configuration of Yumi holds no valid agent provider.",
    );
  });

  it("reads no ops@1 session list while Yumi is not enabled", async () => {
    serve(enablement({}, "disabled"), [item("general")]);

    const { result } = await ready();

    expect(result.current.enabled).toBe(false);
    expect(result.current.view).toBeNull();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
  });

  it("reads nothing while Home is not active", () => {
    serve(enablement());

    const { result } = renderHook(() => useHome(false));

    expect(result.current.status).toBe("idle");
    expect(listAgents).not.toHaveBeenCalled();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
  });

  it("switches to new-session mode on New chat with no API call", async () => {
    serve(enablement(), [item("general")]);
    const { result } = await ready();
    vi.mocked(listWorkbenchSessions).mockClear();

    act(() => result.current.newChat());

    expect(result.current.view).toEqual({ kind: "new" });
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
  });

  it("shows the created conversation with the failure of its first message", async () => {
    serve(enablement());
    const { result } = await ready();
    const failure = { draft: "Hi", code: "unavailable", message: "Down." };

    act(() => result.current.open("created", failure));

    expect(result.current.view).toEqual({ kind: "session", sessionId: "created", failure });
  });

  it("reports a failed agent read and reads again on retry", async () => {
    vi.mocked(listAgents).mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503));
    vi.mocked(listAgents).mockResolvedValue([yumi(enablement())]);
    vi.mocked(listWorkbenchSessions).mockResolvedValue([]);
    const hook = renderHook(() => useHome(true));
    await waitFor(() => expect(hook.result.current.status).toBe("error"));
    expect(hook.result.current.errorMessage).toBe("Down.");

    act(() => hook.result.current.retry());

    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  });
});

describe("yumiConfigurationOf", () => {
  it("answers the default configuration of an enablement", () => {
    expect(yumiConfigurationOf(enablement())).toEqual({ ok: true, configuration: CONFIGURATION });
  });

  it("answers a failure with no enablement", () => {
    expect(yumiConfigurationOf(null).ok).toBe(false);
  });
});
