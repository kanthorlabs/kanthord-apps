import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setConnection } from "@/api/client";
import type { WorkbenchQueuedMessage, WorkbenchRunSnapshot } from "@/api/types";
import type { SnapshotPatch } from "../use-session-events";
import { QueuedMessages } from "./queued-messages";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";
const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

const ONE = { id: "queued_1", text: "First queued message" };
const TWO = { id: "queued_2", text: "Second queued message" };

interface Call {
  readonly method: string;
  readonly url: string;
  readonly idempotencyKey: string | undefined;
}

const calls: Call[] = [];
let respond: () => Promise<Response> = () => Promise.resolve(removed());

function removed(id = "queued_1"): Response {
  return Response.json({ session_id: SESSION_ID, queued_message_id: id });
}

function notFound(): Response {
  return Response.json(
    {
      error: {
        code: "workbench.session.queued_message_not_found",
        message: "The queued message does not exist.",
      },
    },
    { status: 404 },
  );
}

beforeEach(() => {
  calls.length = 0;
  respond = () => Promise.resolve(removed());
  setConnection({ baseUrl: "http://daemon.test", token: "jwt-1" });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: { method: string; headers: Record<string, string> }) => {
      calls.push({
        method: init.method,
        url,
        idempotencyKey: init.headers["idempotency-key"],
      });
      return respond();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  setConnection(null);
});

function Harness({
  initial,
  refill,
}: {
  readonly initial: readonly WorkbenchQueuedMessage[];
  readonly refill: (texts: readonly string[]) => void;
}) {
  const [queue, setQueue] = useState(initial);
  const patchSnapshot = useCallback((patch: SnapshotPatch) => {
    setQueue((held) => {
      const next =
        typeof patch === "function" ? patch({ queue: held } as WorkbenchRunSnapshot) : patch;
      return next.queue ?? held;
    });
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setQueue((held) => [...held, { id: "queued_9", text: "Added later" }])}
      >
        Add item
      </button>
      <button type="button" onClick={() => setQueue((held) => held.slice(1))}>
        Start next
      </button>
      <QueuedMessages
        sessionId={SESSION_ID}
        queue={queue}
        patchSnapshot={patchSnapshot}
        refill={refill}
      />
    </>
  );
}

function mount(initial: readonly WorkbenchQueuedMessage[], refill = vi.fn()) {
  render(<Harness initial={initial} refill={refill} />);
  return refill;
}

const TRIGGER = /queued/;

describe("QueuedMessages", () => {
  it("renders nothing for an empty queue", () => {
    mount([]);

    expect(screen.queryByRole("button", { name: TRIGGER })).toBeNull();
  });

  it("collapses to one line with the count and the next item", () => {
    mount([ONE, TWO]);

    const line = screen.getByRole("button", { name: TRIGGER });
    expect(line).toHaveTextContent("2 queued");
    expect(line).toHaveTextContent("First queued message");
    expect(line).not.toHaveTextContent("Second queued message");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("expands the full list with Edit and Remove on each row", async () => {
    mount([ONE, TWO]);

    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => within(row).getByText(/queued message/).textContent)).toEqual([
      "First queued message",
      "Second queued message",
    ]);
    for (const row of rows) {
      expect(within(row).getByRole("button", { name: "Edit" })).toBeEnabled();
      expect(within(row).getByRole("button", { name: "Remove" })).toBeEnabled();
    }
  });

  it("keeps the open state while the queue changes", async () => {
    mount([ONE, TWO]);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Start next" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  });

  it("keeps the collapsed state while the queue changes", async () => {
    mount([ONE]);

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    expect(screen.getByRole("button", { name: TRIGGER })).toHaveTextContent("2 queued");
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("removes a row with a DELETE that holds an idempotency key", async () => {
    mount([ONE, TWO]);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));
    const [row] = await screen.findAllByRole("listitem");

    await userEvent.click(within(row!).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByText("First queued message", { selector: "p" })).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.url).toBe(
      `http://daemon.test/api/workbench/session/${SESSION_ID}/queue/queued_1`,
    );
    expect(calls[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("refills the composer with the text only after the answer 200 and drops the row", async () => {
    let answer: (response: Response) => void = () => undefined;
    respond = () => new Promise((resolve) => (answer = resolve));
    const refill = mount([ONE, TWO]);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));
    const [row] = await screen.findAllByRole("listitem");

    await userEvent.click(within(row!).getByRole("button", { name: "Edit" }));
    expect(refill).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await act(async () => answer(removed()));

    await waitFor(() => expect(refill).toHaveBeenCalledWith(["First queued message"]));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows the code and the started text for a 404 on Edit and refills nothing", async () => {
    respond = () => Promise.resolve(notFound());
    const refill = mount([ONE, TWO]);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));
    const [row] = await screen.findAllByRole("listitem");

    await userEvent.click(within(row!).getByRole("button", { name: "Edit" }));

    const alert = await within(row!).findByRole("alert");
    expect(alert).toHaveTextContent(
      "workbench.session.queued_message_not_found The message already started.",
    );
    expect(refill).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the same error line for a 404 on Remove", async () => {
    respond = () => Promise.resolve(notFound());
    mount([ONE]);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));
    const [row] = await screen.findAllByRole("listitem");

    await userEvent.click(within(row!).getByRole("button", { name: "Remove" }));

    expect(await within(row!).findByRole("alert")).toHaveTextContent(
      "The message already started.",
    );
  });
});
