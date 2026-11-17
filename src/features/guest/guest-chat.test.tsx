import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { openStream } from "@/api/client";
import { ApiError } from "@/api/errors";
import { readGuestSession, sendGuestMessage } from "@/api/resources/workbench";
import type {
  WorkbenchGuestBlock,
  WorkbenchGuestEntry,
  WorkbenchGuestSession,
  WorkbenchGuestState,
} from "@/api/types";
import { GuestChat } from "./guest-chat";

vi.mock("@/api/client", () => ({ openStream: vi.fn() }));
vi.mock("@/api/resources/workbench", () => ({
  readGuestSession: vi.fn(),
  sendGuestMessage: vi.fn(),
}));

const openStreamMock = vi.mocked(openStream);
const readMock = vi.mocked(readGuestSession);
const sendMock = vi.mocked(sendGuestMessage);

const GUEST_BEARER = "guest-bearer-1";
const CONNECTION = { baseUrl: "http://localhost:31415", token: GUEST_BEARER };
const SESSION_ID = "workbench_session_1";
const IDLE: WorkbenchGuestState = {
  run_active: false,
  display_name: "SWE",
  auto_mode: true,
  streaming: null,
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EntryBody = DistributiveOmit<
  WorkbenchGuestEntry,
  "id" | "session_id" | "agent_name" | "timestamp"
>;

let sequence = 0;

function entry(body: EntryBody, sessionId = SESSION_ID): WorkbenchGuestEntry {
  sequence += 1;
  return {
    id: `e${String(sequence).padStart(4, "0")}`,
    session_id: sessionId,
    agent_name: "swe@1",
    timestamp: "2026-10-05T09:00:00.000Z",
    ...body,
  } as WorkbenchGuestEntry;
}

const userMessage = (text: string) => entry({ kind: "user", text });

const assistantMessage = (content: readonly WorkbenchGuestBlock[]) =>
  entry({ kind: "assistant", content });

const noteRecord = (kind: "owner" | "guest", name: string, text: string) =>
  entry({ kind: "note", text, author: { kind, name } });

function session(
  entries: readonly WorkbenchGuestEntry[],
  fields: Partial<WorkbenchGuestSession> = {},
): WorkbenchGuestSession {
  return {
    session_id: SESSION_ID,
    title: "Account recovery",
    members: [{ session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" }],
    owner_name: "Kanthor Labs",
    entries,
    run_active: false,
    ...fields,
  };
}

function serve(
  entries: readonly WorkbenchGuestEntry[],
  state: WorkbenchGuestState | null = IDLE,
  fields: Partial<WorkbenchGuestSession> = {},
) {
  readMock.mockResolvedValue(session(entries, fields));
  openStreamMock.mockImplementation(async function* (_path, options) {
    if (state !== null) yield { event: "state", data: JSON.stringify(state) };
    await new Promise<void>((resolve) => {
      options?.signal?.addEventListener("abort", () => resolve(), { once: true });
    });
  });
}

beforeEach(() => {
  sequence = 0;
  openStreamMock.mockReset();
  readMock.mockReset();
  sendMock.mockReset();
});

describe("GuestChat", () => {
  it("renders messages, notes and streamed text with no sidebar, switch or Stop", async () => {
    serve(
      [
        userMessage("List the nodes"),
        assistantMessage([{ type: "text", text: "Here are the nodes." }]),
        noteRecord("owner", "Kanthor Labs", "A note from the owner"),
      ],
      {
        run_active: true,
        display_name: "SWE",
        auto_mode: false,
        streaming: { content: [{ type: "text", text: "Reading the" }] },
      },
    );

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("Reading the")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account recovery" })).toBeInTheDocument();
    expect(screen.getByText("Auto mode off")).toBeInTheDocument();
    expect(screen.getByText("List the nodes")).toBeInTheDocument();
    expect(screen.getByText("Here are the nodes.")).toBeInTheDocument();
    expect(screen.getByText("A note from the owner")).toBeInTheDocument();
    expect(screen.getAllByText("Kanthor Labs").length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: "Run line" })).toHaveTextContent("Running");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("shows the owner line and one chip for each member by display name", async () => {
    serve([], null, {
      members: [
        { session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" },
        { session_id: "workbench_session_2", agent_name: "plan@1", display_name: "Plan" },
      ],
    });

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("Shared by Kanthor Labs · guest view")).toBeInTheDocument();
    const chips = within(screen.getByRole("list", { name: "Members" })).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual(["SWE", "Plan"]);
  });

  it("shows no auto mode badge before the first state frame", async () => {
    serve([userMessage("List the nodes")], null);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("List the nodes")).toBeInTheDocument();
    expect(screen.queryByText(/Auto mode/)).not.toBeInTheDocument();
  });

  it("shows the no-title line for a null or an empty title", async () => {
    serve([], IDLE, { title: null });
    const first = render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByRole("heading", { name: "Shared conversation" })).toBeInTheDocument();
    first.unmount();

    serve([], IDLE, { title: "" });
    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByRole("heading", { name: "Shared conversation" })).toBeInTheDocument();
  });

  it("badges a guest note and renders its text literally", async () => {
    serve([noteRecord("guest", "Ulrich", "**x** stays <b>literal</b>")]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("**x** stays <b>literal</b>")).toHaveClass(
      "whitespace-pre-wrap",
    );
    expect(screen.getByText("Ulrich")).toBeInTheDocument();
    expect(screen.getByText("guest")).toBeInTheDocument();
  });

  it("renders a user message as plain text", async () => {
    serve([userMessage("**x** and `code`")]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("**x** and `code`")).toBeInTheDocument();
  });

  it("shows the tool name of an assistant entry with no input and no output", async () => {
    serve([
      assistantMessage([
        { type: "text", text: "Checking." },
        { type: "toolCall", name: "mission.node.list" },
      ]),
    ]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("Checking.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tool Call mission.node.list" })).toBeInTheDocument();
    expect(screen.queryByText("Tool Result")).not.toBeInTheDocument();
  });

  it("builds the streaming message from text blocks and tool names", async () => {
    serve([], {
      run_active: true,
      display_name: null,
      auto_mode: true,
      streaming: {
        content: [
          { type: "text", text: "Reading the" },
          { type: "toolCall", name: "mission.node.list" },
        ],
      },
    });

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("Reading the")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mission\.node\.list/ })).toBeInTheDocument();
  });

  it("shows the title of a fork with no link and the summary block", async () => {
    serve([
      entry({ kind: "fork", source_title: "Account recovery plan" }),
      entry({ kind: "summary", text: "The summary." }),
    ]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText(/Forked from/)).toHaveTextContent(
      "Forked from Account recovery plan",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Summary of Account recovery plan" }),
    ).toBeInTheDocument();
  });

  it("renders a plan entry as the plan item", async () => {
    serve([entry({ kind: "plan", markdown: "Step one of the plan" })]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("Step one of the plan")).toBeInTheDocument();
  });

  it("renders an action offer with its result and no button", async () => {
    serve([
      entry({
        kind: "action_offer",
        tool_call_id: "call_9",
        operation_id: "mission.node.resume",
        target_id: "node_1",
      }),
      entry({ kind: "action_result", tool_call_id: "call_9", text: "Done by the owner." }),
    ]);

    render(<GuestChat connection={CONNECTION} />);

    const card = await screen.findByRole("group", { name: "Action" });
    expect(card).toHaveTextContent("mission.node.resume");
    expect(card).toHaveTextContent("Done by the owner.");
    expect(screen.queryByRole("button", { name: /node_1/ })).not.toBeInTheDocument();
  });

  it("offers no /new and sends /new x as a note", async () => {
    serve([]);
    sendMock.mockResolvedValue({ kind: "note" });
    render(<GuestChat connection={CONNECTION} />);
    const field = await screen.findByRole("combobox", { name: "Message" });

    await userEvent.type(field, "/");

    expect(screen.queryByRole("listbox", { name: "Commands" })).not.toBeInTheDocument();
    expect(screen.queryByText("/new")).not.toBeInTheDocument();

    await userEvent.type(field, "new x");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(sendMock).toHaveBeenCalledWith(CONNECTION, { text: "/new x" });
    expect(field).toHaveValue("");
  });

  it("shows the composer hint line", async () => {
    serve([]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("Note to everyone")).toHaveClass("text-muted-foreground");
  });

  it("shows one line under the composer for a refused text and keeps the draft", async () => {
    serve([]);
    sendMock.mockRejectedValue(
      new ApiError(
        "malformed",
        "Request validation failed.",
        400,
        "gateway.request.validation_failed",
        [{ path: ["body", "text"], code: "too_big" }],
      ),
    );
    render(<GuestChat connection={CONNECTION} />);
    const field = await screen.findByRole("combobox", { name: "Message" });

    await userEvent.type(field, "a long note");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("gateway.request.validation_failed");
    expect(line).toHaveTextContent("The note is too long.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(field).toHaveValue("a long note");
  });

  it("renders no evidence row and no Download for an evidence_read call", async () => {
    serve([
      assistantMessage([
        { type: "toolCall", name: "evidence_read" },
        { type: "text", text: "Read it." },
      ]),
    ]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByText("Read it.")).toBeInTheDocument();
    expect(screen.queryByText(/evidence_read/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("keeps the feed, shows one error line under it and disables the composer on a 401", async () => {
    readMock.mockResolvedValue(session([userMessage("List the nodes")]));
    openStreamMock.mockImplementation(() => {
      throw new ApiError(
        "unauthorized",
        "The invite of this guest ended.",
        401,
        "gateway.jwt.invite_ended",
      );
    });

    render(<GuestChat connection={CONNECTION} />);

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("gateway.jwt.invite_ended The invite of this guest ended.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByText("List the nodes")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows the error box when the first read ends with a 401", async () => {
    readMock.mockRejectedValue(
      new ApiError(
        "unauthorized",
        "The invite of this guest ended.",
        401,
        "gateway.jwt.invite_ended",
      ),
    );

    render(<GuestChat connection={CONNECTION} />);

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("gateway.jwt.invite_ended");
    expect(screen.queryByRole("combobox", { name: "Message" })).not.toBeInTheDocument();
  });
});
