import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type * as routerModule from "react-router-dom";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as footprintApi from "@/api/resources/footprint";
import type {
  FootprintCandidate,
  FootprintCleanupCreateBody,
  FootprintCleanupRecord,
} from "@/api/types";

vi.mock("@/api/resources/footprint");

import { presetPlan, selectionPlan } from "./cleanup-plan";
import { useFootprintCleanup } from "./use-footprint-cleanup";

const navigate = vi.fn();
vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof routerModule>()),
  useNavigate: () => navigate,
}));

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, children);
}

function record(body: FootprintCleanupCreateBody, index: number): FootprintCleanupRecord {
  return {
    cleanup_id: `cleanup_01J9ZQ4XKM3B6V8N2R5T7W0AB${index}`,
    kind: body.kind,
    instance_name: body.instance_name,
    rule: body.rule,
    keys: body.keys,
    requested_by: { kind: "human", account: "ulrich", name: "Ulrich" },
    requested_at: 1,
    state: "queued",
    finished_at: null,
    outcome: null,
  };
}

function candidate(key: string, executionId: string | null): FootprintCandidate {
  return {
    key,
    at: 1,
    bytes: 1,
    project_id: null,
    node_id: null,
    execution_id: executionId,
    refusal: null,
    kept: false,
  };
}

const EXECUTION_A = "execution_01J9ZQ4XKM3B6V8N2R5T7W0AA1";
const EXECUTION_B = "execution_01J9ZQ4XKM3B6V8N2R5T7W0AA2";
const EXECUTION_C = "execution_01J9ZQ4XKM3B6V8N2R5T7W0AA3";
const TRACE_A = "0123456789abcdef0123456789abcde1";
const TRACE_B = "0123456789abcdef0123456789abcde2";
const TRACE_C = "0123456789abcdef0123456789abcde3";

function preset() {
  const plan = presetPlan(
    [
      candidate(TRACE_A, EXECUTION_A),
      candidate(TRACE_B, EXECUTION_B),
      candidate(TRACE_C, EXECUTION_C),
    ],
    [
      {
        instanceName: "mac-studio",
        placement: "worker",
        candidates: [candidate(EXECUTION_A, EXECUTION_A)],
      },
      {
        instanceName: "coder-1",
        placement: "server",
        candidates: [candidate(EXECUTION_B, EXECUTION_B)],
      },
    ],
  );
  if (plan === null) throw new Error("The preset plan is empty.");
  return plan;
}

beforeEach(() => {
  navigate.mockReset();
  let index = 0;
  vi.mocked(footprintApi.createFootprintCleanup).mockReset();
  vi.mocked(footprintApi.createFootprintCleanup).mockImplementation(async (body) => {
    index += 1;
    return record(body, index);
  });
});

describe("useFootprintCleanup", () => {
  it("sends the calls in order and opens the first record", async () => {
    const { result } = renderHook(() => useFootprintCleanup(), { wrapper });

    act(() => result.current.request(preset()));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.plan).toBeNull());
    const calls = vi.mocked(footprintApi.createFootprintCleanup).mock.calls.map(([body]) => body);
    expect(calls.map((body) => [body.kind, body.instance_name])).toEqual([
      ["trace", null],
      ["session", "mac-studio"],
      ["session", "coder-1"],
    ]);
    expect(navigate).toHaveBeenCalledWith("/footprint/cleanups/cleanup_01J9ZQ4XKM3B6V8N2R5T7W0AB1");
  });

  it("sends one session cleanup for each instance with the shared executions only", () => {
    const plan = preset();

    expect(plan.calls[0]).toEqual({
      kind: "trace",
      instance_name: null,
      rule: { name: "older_than", older_than_days: 30 },
      keys: [TRACE_A, TRACE_B],
    });
    expect(plan.calls.slice(1).map((call) => [call.instance_name, call.keys])).toEqual([
      ["mac-studio", [EXECUTION_A]],
      ["coder-1", [EXECUTION_B]],
    ]);
    expect(plan.title).toBe("Delete 2 executions?");
  });

  it("reports both facts when a second call fails and sends nothing again", async () => {
    vi.mocked(footprintApi.createFootprintCleanup)
      .mockImplementationOnce(async (body) => record(body, 1))
      .mockRejectedValueOnce(
        new ApiError(
          "conflict",
          "The worker instance is archived.",
          409,
          "footprint.instance.archived",
        ),
      );
    const { result } = renderHook(() => useFootprintCleanup(), { wrapper });

    act(() => result.current.request(preset()));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe(
      "1 cleanup of 3 recorded: Traces on server (cleanup_01J9ZQ4XKM3B6V8N2R5T7W0AB1). Cleanup 2 of 3 failed: The instance is archived. Its slot and its data are gone with the archive. KanthorD rolls back nothing.",
    );
    expect(result.current.blocked).toBe(true);
    act(() => result.current.confirm());
    expect(footprintApi.createFootprintCleanup).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sends one selection cleanup with the rule that proposed the keys", async () => {
    const { result } = renderHook(() => useFootprintCleanup(), { wrapper });
    const plan = selectionPlan({
      kind: "trace",
      instanceName: null,
      placement: null,
      rule: { name: "older_than", older_than_days: 60 },
      keys: [TRACE_A],
      bytes: 1,
      estimated: true,
    });

    act(() => result.current.request(plan));
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.plan).toBeNull());
    expect(footprintApi.createFootprintCleanup).toHaveBeenCalledWith({
      kind: "trace",
      instance_name: null,
      rule: { name: "older_than", older_than_days: 60 },
      keys: [TRACE_A],
    });
  });
});
