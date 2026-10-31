import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listProjects } from "@/api/resources/projects";
import { readAnalyticsFlow } from "@/api/resources/tracking";
import type { FlowRead, Project } from "@/api/types";

vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/projects");

import flowRead from "../../../../test/flow-read.json";
import { useFlow } from "./use-flow";

const FLOW_READ = flowRead as unknown as FlowRead;
const POLL_MS = 60_000;
const NOW = Date.UTC(2026, 9, 30, 14, 12);
const DAY_MS = 86_400_000;

const PROJECT: Project = {
  id: "prj_1",
  name: "alpha",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj_1",
};

function mount(entry = "/analytics") {
  return renderHook(
    () => ({ flow: useFlow(), location: useLocation(), navigation: useNavigationType() }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
      ),
    },
  );
}

beforeEach(() => {
  vi.mocked(readAnalyticsFlow).mockResolvedValue(FLOW_READ);
  vi.mocked(listProjects).mockResolvedValue([PROJECT]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("useFlow", () => {
  it("reads the query of the URL filters with the clock of the call", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { result } = mount("/analytics?project_id=prj_1&worker_name=coder@1&range=30d");

    await waitFor(() => expect(result.current.flow.read).toEqual(FLOW_READ));

    expect(readAnalyticsFlow).toHaveBeenCalledWith({
      from: Date.UTC(2026, 9, 30) - 29 * DAY_MS,
      to: NOW,
      bucket: "day",
      project_id: "prj_1",
      worker_name: "coder@1",
      compare: "previous",
    });
    expect(result.current.flow.filters).toMatchObject({
      projectId: "prj_1",
      workerName: "coder@1",
      range: "30d",
    });
  });

  it("answers the context line, the badge and the workers of the read", async () => {
    const { result } = mount();

    await waitFor(() => expect(result.current.flow.read).not.toBeNull());

    expect(result.current.flow.contextLine).toBe(
      "All projects · all workers · Oct 24 00:00 – Oct 30 14:12 UTC (today partial) · vs Oct 17 – Oct 23 to the same hour · counted by claim time",
    );
    expect(result.current.flow.dataBadge).toEqual({
      text: "Data 98.4 % · 9 awaiting ingestion",
      active: true,
      href: "/analytics?tab=flow&range=7d#flow-data",
    });
    expect(result.current.flow.workerOptions.map((option) => option.label)).toEqual([
      "claude-code@1",
      "coder@1",
      "reviewer@1",
      "tdd@1",
    ]);
    expect(result.current.flow.projects).toEqual([PROJECT]);
    expect(result.current.flow.empty).toBe(false);
    expect(result.current.flow.rebuildNotice).toBeNull();
  });

  it("answers no derived value before the first read", () => {
    vi.mocked(readAnalyticsFlow).mockReturnValue(new Promise(() => undefined));
    const { result } = mount("/analytics?worker_name=zed@1");

    expect(result.current.flow.read).toBeNull();
    expect(result.current.flow.contextLine).toBeNull();
    expect(result.current.flow.dataBadge).toBeNull();
    expect(result.current.flow.rebuildNotice).toBeNull();
    expect(result.current.flow.notRefreshedSince).toBeNull();
    expect(result.current.flow.workerOptions).toEqual([{ value: "zed@1", label: "zed@1" }]);
  });

  it("flags a read with no execution as empty", async () => {
    vi.mocked(readAnalyticsFlow).mockResolvedValue({
      ...FLOW_READ,
      completeness: { ...FLOW_READ.completeness, executions: 0 },
    });
    const { result } = mount();

    await waitFor(() => expect(result.current.flow.empty).toBe(true));
  });

  it("words the rebuild notice with the day of pending_until", async () => {
    vi.mocked(readAnalyticsFlow).mockResolvedValue({
      ...FLOW_READ,
      rebuild: { pending_until: Date.UTC(2026, 9, 26, 9) },
    });
    const { result } = mount();

    await waitFor(() =>
      expect(result.current.flow.rebuildNotice).toBe(
        "Aggregates rebuild in progress. Numbers before Oct 26 are incomplete.",
      ),
    );
  });

  it("writes each selection to the URL with replace and drops an emptied value", async () => {
    const { result } = mount("/analytics?project_id=prj_1");
    await waitFor(() => expect(result.current.flow.read).not.toBeNull());

    act(() => result.current.flow.selectWorker("tdd@1"));
    act(() => result.current.flow.selectRange("24h"));
    act(() => result.current.flow.selectTab("cost"));
    act(() => result.current.flow.selectProject(null));

    expect(result.current.location.search).toBe("?worker_name=tdd%401&range=24h&tab=cost");
    expect(result.current.navigation).toBe("REPLACE");
    await waitFor(() =>
      expect(vi.mocked(readAnalyticsFlow).mock.lastCall?.[0]).toMatchObject({
        worker_name: "tdd@1",
        bucket: "hour",
      }),
    );
  });

  it("polls every 60 seconds and stops while held", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = mount();
    await waitFor(() => expect(result.current.flow.read).not.toBeNull());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(readAnalyticsFlow).toHaveBeenCalledTimes(2);
    act(() => result.current.flow.setHeld(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });

    expect(result.current.flow.held).toBe(true);
    expect(readAnalyticsFlow).toHaveBeenCalledTimes(2);
  });

  it("keeps the data and names the last read time after a failed later read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { result } = mount();
    await waitFor(() => expect(result.current.flow.read).not.toBeNull());
    vi.setSystemTime(NOW + 90 * 60_000);
    vi.mocked(readAnalyticsFlow).mockRejectedValueOnce(
      new ApiError("unavailable", "The daemon is down.", 503),
    );

    act(() => result.current.flow.refresh());

    await waitFor(() => expect(result.current.flow.error).not.toBeNull());
    expect(result.current.flow.read).toEqual(FLOW_READ);
    expect(result.current.flow.notRefreshedSince).toBe("14:12");
  });
});
