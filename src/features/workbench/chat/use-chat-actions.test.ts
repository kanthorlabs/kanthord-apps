import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchMessageAnswer } from "@/api/types";
import { useChatActions } from "./use-chat-actions";

vi.mock("@/api/resources/workbench", () => ({
  abortWorkbenchRun: vi.fn(),
  approveWorkbenchCall: vi.fn(),
  forkWorkbenchSession: vi.fn(),
  removeQueuedWorkbenchMessage: vi.fn(),
  sendWorkbenchMessage: vi.fn(),
}));

const sendMock = vi.mocked(sendWorkbenchMessage);

const VARIANT_ID = "agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0VA1";

const queuedAnswer = {
  kind: "run",
  session_id: "session_1",
  agent_name: "swe@1",
  run_active: true,
  queued_message_id: "workbench_queued_message_1",
  cleared: [],
} as unknown as WorkbenchMessageAnswer;

beforeEach(() => {
  sendMock.mockReset();
});

describe("useChatActions queued item", () => {
  it("takes the variant id and the name from the matched mention", async () => {
    sendMock.mockResolvedValue(queuedAnswer);
    const patch = vi.fn();
    const { result } = renderHook(() =>
      useChatActions("session_1", patch, null, () => ({
        name: "Software Architecture",
        variantId: VARIANT_ID,
      })),
    );

    await act(() => result.current.send("@Software Architecture review it", "queue"));

    const update = patch.mock.calls[0]?.[0] as (current: { queue: unknown[] }) => {
      queue: unknown[];
    };
    expect(update({ queue: [] }).queue).toEqual([
      {
        id: "workbench_queued_message_1",
        text: "@Software Architecture review it",
        agent_name: "swe@1",
        variant_id: VARIANT_ID,
        display_name: "Software Architecture",
      },
    ]);
  });

  it("keeps a null variant id for a base agent mention", async () => {
    sendMock.mockResolvedValue(queuedAnswer);
    const patch = vi.fn();
    const { result } = renderHook(() =>
      useChatActions("session_1", patch, null, () => ({ name: "SWE", variantId: null })),
    );

    await act(() => result.current.send("@SWE review it", "queue"));

    const update = patch.mock.calls[0]?.[0] as (current: { queue: unknown[] }) => {
      queue: unknown[];
    };
    expect(update({ queue: [] }).queue).toEqual([
      expect.objectContaining({ variant_id: null, display_name: "SWE" }),
    ]);
  });
});
