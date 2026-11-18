import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listInvites } from "@/api/resources/workbench";
import { useInvites } from "./use-invites";

vi.mock("@/api/resources/workbench", () => ({ listInvites: vi.fn() }));

const INVITE = {
  id: "invite_1",
  invitee_name: "Dana",
  expires_at: 1790000000000,
  projects: [{ id: "project_a", name: "Alpha" }],
};

beforeEach(() => {
  vi.mocked(listInvites).mockReset();
});

describe("useInvites", () => {
  it("locks the set from the project_ids of the answer", async () => {
    vi.mocked(listInvites).mockResolvedValue({
      items: [INVITE],
      project_ids: ["project_a", "project_b"],
    });

    const { result } = renderHook(() => useInvites("workbench_session_1"));

    await waitFor(() => expect(result.current.status).toBe("ready"), { timeout: 2000 });
    expect(result.current.shared).toBe(true);
    expect(result.current.lockedProjects).toEqual([
      { id: "project_a", name: "Alpha" },
      { id: "project_b", name: null },
    ]);
  });

  it("holds no lock when the answer holds no project_ids", async () => {
    vi.mocked(listInvites).mockResolvedValue({ items: [], project_ids: null });

    const { result } = renderHook(() => useInvites("workbench_session_1"));

    await waitFor(() => expect(result.current.status).toBe("ready"), { timeout: 2000 });
    expect(result.current.lockedProjects).toBeNull();
  });
});
