import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as workersApi from "@/api/resources/workers";
import type { AgentEnablement, AgentSummary, Credential, HealthEntry } from "@/api/types";
import { failureReasonHint } from "@/lib/failure-reason";

vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/credentials");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAgentEnable } from "./use-agent-enable";

const OPENAI: Credential = {
  name: "openai-main",
  platform: "openai-compatible",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [],
};

const SWE_DISABLED: AgentEnablement = {
  agent_name: "swe@1",
  state: "disabled",
  agent_providers: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas" }],
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
  },
  fallback_configurations: [],
  revision: 4,
};

const RE_NEW: AgentSummary = { agentName: "re@1", workerNames: ["reviewer@1"], enablement: null };
const SWE: AgentSummary = {
  agentName: "swe@1",
  workerNames: ["coder@1"],
  enablement: SWE_DISABLED,
};

function enabled(agentName: string, revision: number): AgentEnablement {
  return { ...SWE_DISABLED, agent_name: agentName, state: "enabled", revision };
}

let location: { pathname: string } = { pathname: "" };

function wrapperAt(state: unknown, hash = "") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/llm/openai-main", hash, state }] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/llm/:credentialName", element: children }),
        createElement(Route, {
          path: "/",
          element: createElement(() => {
            location = { pathname: "/" };
            return null;
          }),
        }),
      ),
    );
  };
}

async function openSheet(reload = vi.fn(), state: unknown = null, replaceSwe = true) {
  const hook = renderHook(() => useAgentEnable(OPENAI, reload), { wrapper: wrapperAt(state) });
  await waitFor(() => expect(hook.result.current.agentNames.length).toBeGreaterThan(0));
  act(() => hook.result.current.start());
  if (replaceSwe) act(() => hook.result.current.toggleAgent("swe@1", true));
  await waitFor(() => expect(hook.result.current.reasoningEffort).toBe("medium"));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  location = { pathname: "" };
  vi.mocked(workersApi.listAgents).mockResolvedValue([RE_NEW, SWE]);
  vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
    { model_identifier: "gpt-5", reasoning_efforts: ["low", "medium", "high"] },
  ]);
  vi.mocked(workersApi.putAgentEnablement).mockImplementation((agentName, body) =>
    Promise.resolve(
      agentName === "swe@1"
        ? { ...SWE_DISABLED, revision: 5 }
        : { ...enabled(agentName, 1), agent_providers: body.agent_providers },
    ),
  );
  vi.mocked(workersApi.enableAgentEnablement).mockResolvedValue(enabled("swe@1", 6));
  vi.mocked(credentialsApi.verifyCredential).mockResolvedValue(HEALTHY);
});

const HEALTHY: HealthEntry = {
  status: "healthy",
  capability: "model-list read",
  failure_reason: null,
};
const UNHEALTHY: HealthEntry = {
  status: "unhealthy",
  capability: "model-list read",
  failure_reason: "unauthorized",
};

describe("useAgentEnable", () => {
  it("opens the sheet on arrival with the enable agents hash", async () => {
    const { result } = renderHook(() => useAgentEnable(OPENAI, vi.fn()), {
      wrapper: wrapperAt({ return_to: "/" }, "#enable-agents"),
    });

    await waitFor(() => expect(result.current.open).toBe(true));
    await waitFor(() => expect(result.current.modelIdentifier).toBe("gpt-5"));
  });

  it("drops the hash after the open and keeps the return path", async () => {
    const { result, rerender } = renderHook(
      () => ({ enable: useAgentEnable(OPENAI, vi.fn()), location: useLocation() }),
      { wrapper: wrapperAt({ return_to: "/" }, "#enable-agents") },
    );

    await waitFor(() => expect(result.current.enable.open).toBe(true));
    await waitFor(() => expect(result.current.location.hash).toBe(""));
    expect(result.current.location.state).toEqual({ return_to: "/" });
    act(() => result.current.enable.close());
    rerender();

    expect(result.current.enable.open).toBe(false);
  });

  it("keeps the sheet closed on arrival with no hash", async () => {
    const { result } = renderHook(() => useAgentEnable(OPENAI, vi.fn()), {
      wrapper: wrapperAt(null),
    });

    await waitFor(() => expect(result.current.agentNames.length).toBeGreaterThan(0));
    expect(result.current.open).toBe(false);
  });

  it("prefills the first model and the medium effort", async () => {
    const { result } = await openSheet();

    expect(workersApi.listCredentialModels).toHaveBeenCalledWith(
      "openai-compatible",
      "openai-main",
    );
    expect(result.current.modelIdentifier).toBe("gpt-5");
    expect(result.current.rows.map((row) => row.agentName)).toEqual(["re@1", "swe@1"]);
  });

  it("switches on a new agent and leaves the replace of a disabled enablement off", async () => {
    const { result } = await openSheet(vi.fn(), null, false);

    expect(result.current.rows).toEqual([
      { agentName: "re@1", on: true, replaces: null },
      { agentName: "swe@1", on: false, replaces: 4 },
    ]);
    act(() => result.current.submit());
    await waitFor(() => expect(workersApi.putAgentEnablement).toHaveBeenCalledOnce());
    expect(workersApi.putAgentEnablement).toHaveBeenCalledWith("re@1", expect.anything());
  });

  it("names the agent provider after a new credential", async () => {
    const { result } = await openSheet();

    act(() => result.current.submit());

    await waitFor(() => expect(workersApi.putAgentEnablement).toHaveBeenCalledTimes(2));
    expect(workersApi.putAgentEnablement).toHaveBeenCalledWith("re@1", {
      agent_providers: [
        { name: "openai-main", provider: "openai-compatible", credential: "openai-main" },
      ],
      default_configuration: {
        agent_provider: "openai-main",
        model_identifier: "gpt-5",
        reasoning_effort: "medium",
      },
      fallback_configurations: [],
    });
  });

  it("reuses the agent provider name of a known credential", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([
      RE_NEW,
      {
        agentName: "pm@1",
        workerNames: ["planner@1"],
        enablement: {
          ...enabled("pm@1", 2),
          agent_providers: [
            { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
          ],
        },
      },
    ]);
    const { result } = await openSheet();

    act(() => result.current.submit());

    await waitFor(() => expect(workersApi.putAgentEnablement).toHaveBeenCalledOnce());
    expect(vi.mocked(workersApi.putAgentEnablement).mock.calls[0]?.[1].agent_providers).toEqual([
      { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
    ]);
  });

  it("sends the revision of a disabled enablement and enables it after the save", async () => {
    const { result } = await openSheet();

    act(() => result.current.submit());

    await waitFor(() => expect(workersApi.enableAgentEnablement).toHaveBeenCalledWith("swe@1", 5));
    expect(vi.mocked(workersApi.putAgentEnablement).mock.calls[1]?.[1].expected_revision).toBe(4);
    expect(vi.mocked(workersApi.putAgentEnablement).mock.calls[0]?.[1]).not.toHaveProperty(
      "expected_revision",
    );
  });

  it("reports each outcome when one of two saves fails", async () => {
    const reload = vi.fn();
    vi.mocked(workersApi.putAgentEnablement).mockImplementation((agentName) =>
      agentName === "swe@1"
        ? Promise.reject(new ApiError("conflict", "Agent enablement revision conflict.", 409))
        : Promise.resolve(enabled(agentName, 1)),
    );
    const { result } = await openSheet(reload);

    act(() => result.current.submit());

    await waitFor(() => expect(result.current.outcomes).toHaveLength(2));
    expect(result.current.outcomes).toEqual([
      { agentName: "re@1", result: "enabled", revision: 1, reason: null },
      {
        agentName: "swe@1",
        result: "refused",
        revision: null,
        reason: "Agent enablement revision conflict.",
      },
    ]);
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalled();
  });

  it("reports a saved configuration that stays disabled", async () => {
    vi.mocked(workersApi.enableAgentEnablement).mockRejectedValue(
      new ApiError("conflict", "The binding is not valid.", 409),
    );
    const { result } = await openSheet();

    act(() => result.current.submit());

    await waitFor(() => expect(result.current.outcomes).toHaveLength(2));
    expect(result.current.outcomes[1]).toEqual({
      agentName: "swe@1",
      result: "saved",
      revision: 5,
      reason: "The binding is not valid.",
    });
  });

  it("retries only the enable of a saved agent at its saved revision", async () => {
    vi.mocked(workersApi.enableAgentEnablement)
      .mockRejectedValueOnce(new ApiError("conflict", "The binding is not valid.", 409))
      .mockResolvedValueOnce(enabled("swe@1", 6));
    const { result } = await openSheet();
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.outcomes).toHaveLength(2));
    vi.mocked(workersApi.putAgentEnablement).mockClear();

    act(() => result.current.submit());

    await waitFor(() => expect(result.current.open).toBe(false));
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
    expect(workersApi.enableAgentEnablement).toHaveBeenLastCalledWith("swe@1", 5);
  });

  it("asks before it enables the agents with an unhealthy credential", async () => {
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValue(UNHEALTHY);
    const { result } = await openSheet();
    expect(credentialsApi.verifyCredential).toHaveBeenCalledWith("llm", "openai-main");

    act(() => result.current.submit());

    await waitFor(() => expect(result.current.unhealthyCredential).toBe("openai-main"));
    expect(result.current.unhealthyHint).toBe(failureReasonHint("unauthorized", "llm"));
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
    act(() => result.current.confirmUnhealthy());
    await waitFor(() => expect(workersApi.putAgentEnablement).toHaveBeenCalledTimes(2));
  });

  it("waits for a late verify answer before it decides", async () => {
    let answer: (entry: HealthEntry) => void = () => {};
    vi.mocked(credentialsApi.verifyCredential).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = await openSheet();

    act(() => result.current.submit());
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
    act(() => answer(UNHEALTHY));

    await waitFor(() => expect(result.current.unhealthyCredential).toBe("openai-main"));
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
  });

  it("leaves the effort empty and sends nothing when the first model lacks medium", async () => {
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "glm-4.6", reasoning_efforts: ["off", "low"] },
    ]);
    const { result } = renderHook(() => useAgentEnable(OPENAI, vi.fn()), {
      wrapper: wrapperAt(null),
    });
    await waitFor(() => expect(result.current.agentNames.length).toBeGreaterThan(0));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.modelIdentifier).toBe("glm-4.6"));

    expect(result.current.reasoningEffort).toBe("");
    expect(result.current.missing).toContain("Reasoning effort");
    act(() => result.current.submit());
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
  });

  it("blocks with no agent when no hosted worker declares one", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([]);
    const { result } = renderHook(() => useAgentEnable(OPENAI, vi.fn()), {
      wrapper: wrapperAt(null),
    });

    await waitFor(() => expect(result.current.blocked).toBe("No hosted worker declares an agent."));
  });

  it("sends only the agents that stay switched on", async () => {
    const { result } = await openSheet();

    act(() => result.current.toggleAgent("swe@1", false));
    act(() => result.current.submit());

    await waitFor(() => expect(workersApi.putAgentEnablement).toHaveBeenCalledOnce());
    expect(workersApi.putAgentEnablement).toHaveBeenCalledWith("re@1", expect.anything());
  });

  it("returns to the path of the router state after every agent is enabled", async () => {
    const { result } = await openSheet(vi.fn(), { return_to: "/" });

    act(() => result.current.submit());

    await waitFor(() => expect(location.pathname).toBe("/"));
  });

  it("closes the sheet and stays when no return path exists", async () => {
    const { result } = await openSheet();

    act(() => result.current.submit());

    await waitFor(() => expect(result.current.open).toBe(false));
    expect(location.pathname).toBe("");
  });

  it("blocks a credential of a platform that no agent provider serves", async () => {
    const { result } = renderHook(
      () =>
        useAgentEnable(
          {
            name: "gw",
            platform: "cloudflare-ai-gateway",
            holder: "server",
            sealed_to: null,
            sealed_current: true,
            revisions: [],
          },
          vi.fn(),
        ),
      { wrapper: wrapperAt(null) },
    );

    await waitFor(() =>
      expect(result.current.blocked).toBe(
        "An agent cannot use a credential of platform cloudflare-ai-gateway.",
      ),
    );
  });
});
