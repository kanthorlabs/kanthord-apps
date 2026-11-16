import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { WorkbenchSession } from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");
vi.mock("@/features/auth/session/session-context", () => ({
  useSession: () => ({
    session: {
      instance: { id: "i-local", name: "local", baseUrl: "http://localhost:31415" },
      token: "jwt-1",
      identity: { kind: "human", sub: "kanthorlabs", name: "Ulrich" },
    },
  }),
}));

import { ChatScreen } from "@/features/workbench/chat/chat-screen";

const CASE_ID = "workbench_session_CASE";
const FORK_ID = "workbench_session_FORK";

const CASE_SESSION: WorkbenchSession = {
  id: CASE_ID,
  agent_name: "ops@1",
  configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
  },
  members: [{ session_id: CASE_ID, agent_name: "ops@1", display_name: "Yumi" }],
  entries: [
    {
      session_id: CASE_ID,
      agent_name: "ops@1",
      type: "message",
      id: "e1",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      message: { role: "user", content: "Case: node `n` (Blocked). Explain." },
    },
  ],
  run_active: false,
  forked_from: null,
  resume_command: "pi --session ~/session.jsonl",
};

function Where() {
  const { pathname } = useLocation();
  return <p>Path {pathname}</p>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(CASE_SESSION);
  vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(
    () => new Promise(() => undefined),
  );
  vi.mocked(workersApi.readAgent).mockResolvedValue({ enablement: null } as never);
  vi.mocked(workersApi.listAgents).mockResolvedValue([]);
  vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([]);
});

describe("a case tab", () => {
  it("forks in place and shows the fork in the same tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.mocked(workbenchApi.forkWorkbenchSession).mockResolvedValue({
      session_id: FORK_ID,
      run_active: true,
    });
    render(
      <MemoryRouter initialEntries={[`/workbench/${CASE_ID}`]}>
        <Where />
        <Routes>
          <Route path="/workbench/:sessionId" element={<ChatScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "/new x");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(`Path /workbench/${FORK_ID}`)).toBeTruthy();
    expect(workbenchApi.forkWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(workbenchApi.forkWorkbenchSession).toHaveBeenCalledWith(CASE_ID, {
      text: "x",
      signal: expect.any(AbortSignal),
    });
    expect(open).not.toHaveBeenCalled();
  });
});
