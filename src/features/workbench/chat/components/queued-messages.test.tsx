import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type {
  WorkbenchQueuedMessage,
  WorkbenchQueueRemoveAnswer,
  WorkbenchSessionEvents,
} from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { ChatView } from "./chat-view";
import { QueuedMessages } from "./queued-messages";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const ONE = { id: "queued_1", text: "First queued message" };
const TWO = { id: "queued_2", text: "Second queued message" };

const TRIGGER = /queued/;

function Harness({ initial }: { readonly initial: readonly WorkbenchQueuedMessage[] }) {
  const [queue, setQueue] = useState(initial);
  return (
    <>
      <button
        type="button"
        onClick={() => setQueue((held) => [...held, { id: "queued_9", text: "Added later" }])}
      >
        Add item
      </button>
      <button type="button" onClick={() => setQueue([])}>
        Empty queue
      </button>
      <button type="button" onClick={() => setQueue((held) => held.slice(1))}>
        Start next
      </button>
      <QueuedMessages
        queue={queue}
        busy={false}
        failure={null}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    </>
  );
}

describe("QueuedMessages", () => {
  it("renders nothing for an empty queue", () => {
    render(<Harness initial={[]} />);

    expect(screen.queryByRole("button", { name: TRIGGER })).toBeNull();
  });

  it("collapses to one line with the count and the next item", () => {
    render(<Harness initial={[ONE, TWO]} />);

    const line = screen.getByRole("button", { name: TRIGGER });
    expect(line).toHaveTextContent("2 queued");
    expect(line).toHaveTextContent("Next: First queued message");
    expect(line).toHaveTextContent("Show all ▾");
    expect(line).not.toHaveTextContent("Second queued message");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("expands the numbered list with Edit and Remove on each row and hides the next text", async () => {
    render(<Harness initial={[ONE, TWO]} />);

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
    const line = screen.getByRole("button", { name: TRIGGER });
    expect(line).toHaveTextContent("Hide ▴");
    expect(line).not.toHaveTextContent("Next:");
  });

  it("keeps the open state while the queue changes", async () => {
    render(<Harness initial={[ONE, TWO]} />);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Start next" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  });

  it("keeps the open state when the queue empties and fills again", async () => {
    render(<Harness initial={[ONE]} />);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Empty queue" }));
    expect(screen.queryByRole("button", { name: TRIGGER })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps the collapsed state while the queue changes", async () => {
    render(<Harness initial={[ONE]} />);

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    expect(screen.getByRole("button", { name: TRIGGER })).toHaveTextContent("2 queued");
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("shows the failure line while the queue is empty", () => {
    render(
      <QueuedMessages
        queue={[]}
        busy={false}
        failure={{
          cause: "queue",
          code: "workbench.session.queued_message_not_found",
          message: "The message already started.",
        }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "workbench.session.queued_message_not_found The message already started.",
    );
  });
});

const CONFIGURATION = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "low",
} as const;

function eventsWith(queue: readonly WorkbenchQueuedMessage[]): WorkbenchSessionEvents {
  return {
    entries: [],
    snapshot: {
      streaming_message: null,
      pending_tool_calls: [],
      pending_approval: null,
      queue,
      run_active: true,
      error_message: null,
    },
    version: 1,
  };
}

function removed(id: string): WorkbenchQueueRemoveAnswer {
  return { session_id: SESSION_ID, queued_message_id: id };
}

function notFound(): ApiError {
  return new ApiError(
    "not_found",
    "The queued message does not exist.",
    404,
    "workbench.session.queued_message_not_found",
  );
}

function renderChat() {
  return render(
    <MemoryRouter initialEntries={[`/workbench/${SESSION_ID}`]}>
      <ChatView
        session={{
          id: SESSION_ID,
          agent_name: "swe@1",
          configuration: CONFIGURATION,
          entries: [],
          run_active: true,
          resume_command: "pi --session ~/session.jsonl",
        }}
        enablement={null}
        ownerName="Ulrich"
        agentDisplayName="SWE"
      />
    </MemoryRouter>,
  );
}

function mountChat(queue: readonly WorkbenchQueuedMessage[]) {
  vi.mocked(workbenchApi.readWorkbenchEvents).mockResolvedValueOnce(eventsWith(queue));
  return renderChat();
}

async function openList() {
  await userEvent.click(await screen.findByRole("button", { name: TRIGGER }));
  return screen.findAllByRole("listitem");
}

const box = () => screen.getByRole("combobox", { name: "Message" });

describe("queued messages in the chat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(
      () => new Promise(() => undefined),
    );
    vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([]);
  });

  it("removes a row with the queue remove call and drops it after the answer 200", async () => {
    vi.mocked(workbenchApi.removeQueuedWorkbenchMessage).mockResolvedValue(removed("queued_1"));
    mountChat([ONE, TWO]);
    const [row] = await openList();

    await userEvent.click(within(row!).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(workbenchApi.removeQueuedWorkbenchMessage).toHaveBeenCalledWith(SESSION_ID, "queued_1");
    expect(screen.queryByText("First queued message", { selector: "p" })).toBeNull();
    expect(box()).toHaveValue("");
  });

  it("refills the composer before the draft only after the answer 200 and drops the row", async () => {
    let answer: (value: WorkbenchQueueRemoveAnswer) => void = () => undefined;
    vi.mocked(workbenchApi.removeQueuedWorkbenchMessage).mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    mountChat([ONE, TWO]);
    await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "my draft");
    const [row] = await openList();

    await userEvent.click(within(row!).getByRole("button", { name: "Edit" }));
    expect(box()).toHaveValue("my draft");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await act(async () => answer(removed("queued_1")));

    await waitFor(() => expect(box()).toHaveValue("First queued message\nmy draft"));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows the code and the started text for a 404 on Edit and keeps the draft", async () => {
    vi.mocked(workbenchApi.removeQueuedWorkbenchMessage).mockRejectedValue(notFound());
    mountChat([ONE, TWO]);
    await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "my draft");
    const [row] = await openList();

    await userEvent.click(within(row!).getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "workbench.session.queued_message_not_found The message already started.",
    );
    expect(box()).toHaveValue("my draft");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the same error line for a 404 on Remove", async () => {
    vi.mocked(workbenchApi.removeQueuedWorkbenchMessage).mockRejectedValue(notFound());
    mountChat([ONE]);
    const [row] = await openList();

    await userEvent.click(within(row!).getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The message already started.");
  });

  it("keeps the 404 line after the next poll empties the queue", async () => {
    vi.mocked(workbenchApi.removeQueuedWorkbenchMessage).mockRejectedValue(notFound());
    let poll: (value: WorkbenchSessionEvents) => void = () => undefined;
    vi.mocked(workbenchApi.readWorkbenchEvents).mockReset();
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockResolvedValueOnce(eventsWith([ONE]))
      .mockReturnValueOnce(new Promise((resolve) => (poll = resolve)))
      .mockImplementation(() => new Promise(() => undefined));
    renderChat();
    const [row] = await openList();
    await userEvent.click(within(row!).getByRole("button", { name: "Remove" }));
    await screen.findByRole("alert");

    await act(async () => poll({ ...eventsWith([]), version: 2 }));

    await waitFor(() => expect(screen.queryByRole("button", { name: TRIGGER })).toBeNull());
    expect(screen.getByRole("alert")).toHaveTextContent("The message already started.");
  });

  it("clears the 404 line on the next owner action", async () => {
    vi.mocked(workbenchApi.removeQueuedWorkbenchMessage)
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(removed("queued_2"));
    mountChat([ONE, TWO]);
    const [first, second] = await openList();
    await userEvent.click(within(first!).getByRole("button", { name: "Remove" }));
    await screen.findByRole("alert");

    await userEvent.click(within(second!).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
