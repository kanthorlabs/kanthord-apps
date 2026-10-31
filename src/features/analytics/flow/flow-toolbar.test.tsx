import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listProjects } from "@/api/resources/projects";
import { readAnalyticsFlow } from "@/api/resources/tracking";
import type { FlowRead, Project } from "@/api/types";

vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/projects");

import flowRead from "../../../../test/flow-read.json";
import { textContent } from "../../../../test/text-content";
import { FlowToolbar } from "./flow-toolbar";
import { useFlow } from "./use-flow";

const FLOW_READ = flowRead as unknown as FlowRead;
const POLL_MS = 60_000;
const BADGE = "Data 98.4 % · 9 awaiting ingestion";

function project(id: string, name: string): Project {
  return {
    id,
    name,
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: `/state/${id}`,
  };
}

function Harness() {
  const flow = useFlow();
  return <FlowToolbar flow={flow} onRefresh={flow.refresh} />;
}

function Probe() {
  const location = useLocation();
  return <p>{`at ${location.search}`}</p>;
}

function mount(entry = "/analytics") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
      <Probe />
    </MemoryRouter>,
  );
}

async function openOptions(user: ReturnType<typeof userEvent.setup>, select: string) {
  await user.click(await screen.findByRole("combobox", { name: select }));
  return (await screen.findAllByRole("option")).map((option) => option.textContent);
}

beforeEach(() => {
  vi.mocked(readAnalyticsFlow).mockResolvedValue(FLOW_READ);
  vi.mocked(listProjects).mockResolvedValue([project("prj_1", "alpha"), project("prj_2", "zeta")]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("FlowToolbar", () => {
  it("lists the workers of the read in name order after All workers", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("link", { name: /Data 98.4 %/ });

    expect(await openOptions(user, "Worker")).toEqual([
      "All workers",
      "claude-code@1",
      "coder@1",
      "reviewer@1",
      "tdd@1",
    ]);
  });

  it("keeps the current worker of the URL in the options before the read", async () => {
    vi.mocked(readAnalyticsFlow).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    mount("/analytics?worker_name=zed@1");

    expect(await openOptions(user, "Worker")).toEqual(["All workers", "zed@1"]);
  });

  it("lists the projects of listProjects after All projects", async () => {
    const user = userEvent.setup();
    mount();

    expect(await openOptions(user, "Project")).toEqual(["All projects", "alpha", "zeta"]);
  });

  it("writes the worker and the range to the URL and reads again", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("link", { name: /Data 98.4 %/ });

    await user.click(await screen.findByRole("combobox", { name: "Worker" }));
    await user.click(await screen.findByRole("option", { name: "tdd@1" }));
    await waitFor(() =>
      expect(vi.mocked(readAnalyticsFlow).mock.lastCall?.[0]).toMatchObject({
        worker_name: "tdd@1",
      }),
    );
    await user.click(screen.getByRole("button", { name: "30d" }));

    await waitFor(() =>
      expect(vi.mocked(readAnalyticsFlow).mock.lastCall?.[0]).toMatchObject({
        worker_name: "tdd@1",
        bucket: "day",
      }),
    );
    expect(screen.getByText("at ?worker_name=tdd%401&range=30d")).toBeInTheDocument();
  });

  it("marks the range of the URL as pressed and keeps it pressed on a second click", async () => {
    const user = userEvent.setup();
    mount("/analytics?range=24h");

    const hours = screen.getByRole("button", { name: "24h" });
    expect(hours).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "7d" })).toHaveAttribute("aria-pressed", "false");
    await user.click(hours);

    expect(screen.getByRole("button", { name: "24h" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "Compare" })).toBeNull();
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();
  });

  it("stays usable while the first read runs", async () => {
    vi.mocked(readAnalyticsFlow).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "24h" }));

    expect(screen.getByText("at ?range=24h")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Project" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Worker" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: /Data/ })).toBeNull();
  });

  it("shows the data badge with the warn icon and a link to the data footer", async () => {
    mount();

    const badge = await screen.findByRole("link", { name: /Warning\s*Data 98.4 %/ });
    expect(badge).toHaveTextContent(`Warning ${BADGE}`);
    expect(badge).toHaveAttribute("href", "/analytics?tab=flow&range=7d#flow-data");
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the project, the worker and the range on the link of the badge", async () => {
    mount("/analytics?project_id=prj_1&worker_name=coder@1&range=24h");

    expect(await screen.findByRole("link", { name: /Data 98.4 %/ })).toHaveAttribute(
      "href",
      "/analytics?tab=flow&project_id=prj_1&worker_name=coder%401&range=24h#flow-data",
    );
  });

  it("shows no awaiting text and no warn icon when nothing is awaiting", async () => {
    vi.mocked(readAnalyticsFlow).mockResolvedValue({
      ...FLOW_READ,
      completeness: { ...FLOW_READ.completeness, awaiting_ingestion: [] },
    });
    mount();

    const badge = await screen.findByRole("link", { name: "Data 99.7 %" });
    expect(badge).not.toHaveTextContent("awaiting");
    expect(screen.queryByText("Warning")).toBeNull();
  });

  it("shows the warn icon for a completeness below 98 % with nothing awaiting", async () => {
    vi.mocked(readAnalyticsFlow).mockResolvedValue({
      ...FLOW_READ,
      completeness: {
        ...FLOW_READ.completeness,
        exit_unknown: 30,
        awaiting_ingestion: [],
      },
    });
    mount();

    expect(await screen.findByText("Warning")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Data 95.\d %/ })).toBeInTheDocument();
  });

  it("sets aria-pressed on Pause auto-refresh and holds the poll", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    mount();
    await screen.findByRole("link", { name: /Data 98.4 %/ });
    const pause = screen.getByRole("button", { name: "Pause auto-refresh" });
    expect(pause).toHaveAttribute("aria-pressed", "false");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(readAnalyticsFlow).toHaveBeenCalledTimes(2);
    await user.click(pause);
    expect(pause).toHaveAttribute("aria-pressed", "true");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });
    expect(readAnalyticsFlow).toHaveBeenCalledTimes(2);
    await user.click(pause);

    expect(pause).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(readAnalyticsFlow).toHaveBeenCalledTimes(3));
  });

  it("reads again on the shared Refresh", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("link", { name: /Data 98.4 %/ });

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(readAnalyticsFlow).toHaveBeenCalledTimes(2));
  });

  it("shows Not refreshed since the last read and keeps the data after a failed later read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 9, 30, 14, 12));
    const user = userEvent.setup();
    mount();
    await screen.findByRole("link", { name: /Data 98.4 %/ });
    expect(screen.queryByText(/Not refreshed since/)).toBeNull();
    vi.setSystemTime(Date.UTC(2026, 9, 30, 15, 40));
    vi.mocked(readAnalyticsFlow).mockRejectedValueOnce(
      new ApiError("unavailable", "The daemon is down.", 503),
    );

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText(textContent("Not refreshed since 14:12 · Retry")),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Data 98.4 %/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.queryByText(/Not refreshed since/)).toBeNull());
    expect(screen.getByRole("link", { name: /Data 98.4 %/ })).toBeInTheDocument();
  });

  it("shows no Not refreshed text after a failed first read", async () => {
    vi.mocked(readAnalyticsFlow).mockRejectedValue(
      new ApiError("unavailable", "The daemon is down.", 503),
    );
    mount();

    await waitFor(() => expect(readAnalyticsFlow).toHaveBeenCalled());
    expect(screen.queryByText(/Not refreshed since/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
