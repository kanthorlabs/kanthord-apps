import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pauseProject, readProject } from "@/api/resources/projects";
import { readWorkbenchEvents, reportWorkbenchAction } from "@/api/resources/workbench";
import { listAgentProviderModels } from "@/api/resources/workers";
import type { AgentEnablement, Project, WorkbenchSession } from "@/api/types";
import { ChatView } from "./chat-view";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const SESSION_ID = "workbench_session_1";

const ENABLEMENT: AgentEnablement = {
  agent_name: "swe@1",
  state: "enabled",
  agent_providers: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
  },
  fallback_configurations: [],
  revision: 2,
};

const SESSION: WorkbenchSession = {
  id: SESSION_ID,
  agent_name: "swe@1",
  configuration: ENABLEMENT.default_configuration,
  entries: [
    {
      type: "custom",
      id: "e1",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      customType: "kanthord.workbench.record",
      data: {
        kind: "action_offer",
        tool_call_id: "call_1",
        operation_id: "project.pause",
        target_id: "prj-1",
        seen: { name: "Billing", paused: false },
      },
    },
  ],
  run_active: false,
  resume_command: "pi --session ~/session.jsonl",
};

function project(pausedAt: number | null): Project {
  return {
    id: "prj-1",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: pausedAt,
    workspace_directory: "/state/prj-1",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readWorkbenchEvents).mockImplementation(() => new Promise(() => undefined));
  vi.mocked(listAgentProviderModels).mockResolvedValue([
    { model_identifier: "qwen3-coder", reasoning_efforts: ["off"] },
  ]);
  vi.mocked(readProject).mockResolvedValue(project(null));
  vi.mocked(pauseProject).mockResolvedValue(project(5));
  vi.mocked(reportWorkbenchAction).mockResolvedValue({
    session_id: SESSION_ID,
    tool_call_id: "call_1",
    outcome: "done",
  });
});

describe("ChatView action card", () => {
  it.each([
    ["Pause project", "Confirm"],
    ["Keep the project active", "Cancel"],
  ])("focuses the card group and keeps the command list closed after %s", async (name) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChatView
          session={SESSION}
          enablement={ENABLEMENT}
          ownerName="Ulrich"
          agentDisplayName="SWE"
        />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Pause prj-1" }));
    await user.click(await screen.findByRole("button", { name }));

    await waitFor(() => expect(screen.getByRole("group", { name: "Action" })).toHaveFocus());
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
  });
});
