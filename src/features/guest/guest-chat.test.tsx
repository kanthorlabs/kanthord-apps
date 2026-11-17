import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { openStream } from "@/api/client";
import { ApiError } from "@/api/errors";
import { readGuestSession, sendGuestMessage } from "@/api/resources/workbench";
import {
  WORKBENCH_FORK_FRAME,
  WORKBENCH_FORK_PREFIX,
  type WorkbenchGuestSession,
  type WorkbenchGuestState,
  type WorkbenchSessionEntry,
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
const RECORD_TYPE = "kanthord.workbench.record";
const IDLE: WorkbenchGuestState = {
  run_active: false,
  display_name: "SWE",
  auto_mode: true,
  streaming: null,
};

let sequence = 0;

function entry(
  type: string,
  fields: Readonly<Record<string, unknown>>,
  sessionId = SESSION_ID,
): WorkbenchSessionEntry {
  sequence += 1;
  return {
    session_id: sessionId,
    agent_name: "swe@1",
    type,
    id: `e${String(sequence).padStart(4, "0")}`,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    ...fields,
  };
}

const userMessage = (text: string) =>
  entry("message", { message: { role: "user", content: text } });

const assistantMessage = (content: readonly unknown[]) =>
  entry("message", { message: { role: "assistant", content, stopReason: "stop" } });

const noteRecord = (kind: "owner" | "guest", name: string, text: string) =>
  entry("custom", {
    customType: RECORD_TYPE,
    data: { kind: "note", text, author: { kind, name } },
  });

function session(entries: readonly WorkbenchSessionEntry[]): WorkbenchGuestSession {
  return {
    session_id: SESSION_ID,
    title: "Account recovery",
    members: [{ session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" }],
    owner_name: "Kanthor Labs",
    entries,
    run_active: false,
  };
}

function serve(entries: readonly WorkbenchSessionEntry[], state: WorkbenchGuestState = IDLE) {
  readMock.mockResolvedValue(session(entries));
  openStreamMock.mockImplementation(async function* (_path, options) {
    yield { event: "state", data: JSON.stringify(state) };
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
      { run_active: true, display_name: "SWE", auto_mode: false, streaming: "Reading the" },
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

  it("shows the tool name with no input and no output", async () => {
    serve([
      assistantMessage([
        {
          type: "toolCall",
          id: "call_1",
          name: "mission.node.list",
          arguments: { secret: "arg-7" },
        },
        { type: "futureField", payload: "frame-extra-9" },
      ]),
      entry("message", {
        message: {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "mission.node.list",
          isError: false,
          content: [{ type: "text", text: "output-3" }],
          details: { leaked: "details-5" },
        },
      }),
    ]);

    render(<GuestChat connection={CONNECTION} />);

    expect(
      await screen.findByRole("button", { name: "Tool Call mission.node.list" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/arg-7/)).not.toBeInTheDocument();
    expect(screen.queryByText(/output-3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/details-5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/frame-extra-9/)).not.toBeInTheDocument();
    expect(screen.queryByText("Tool Result")).not.toBeInTheDocument();
  });

  it("shows the title of a fork with no link and the summary block", async () => {
    serve([
      entry("custom", {
        customType: RECORD_TYPE,
        data: { kind: "fork", source_title: "Account recovery plan" },
      }),
      userMessage(
        `${WORKBENCH_FORK_PREFIX}workbench_session_src.${WORKBENCH_FORK_FRAME}\n\nThe summary.`,
      ),
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

  it("renders an action offer with no button", async () => {
    serve([
      entry("custom", {
        customType: RECORD_TYPE,
        data: {
          kind: "action_offer",
          tool_call_id: "call_9",
          operation_id: "mission.node.resume",
          target_id: "node_1",
          seen: { name: "api", state: "Paused", attempt: 1 },
        },
      }),
    ]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByRole("group", { name: "Action" })).toBeInTheDocument();
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

  it("renders no evidence row and no Download", async () => {
    serve([
      assistantMessage([
        {
          type: "toolCall",
          id: "call_e",
          name: "evidence_read",
          arguments: { asset_id: "asset_1" },
        },
      ]),
      entry("message", {
        message: {
          role: "toolResult",
          toolCallId: "call_e",
          toolName: "evidence_read",
          isError: false,
          content: [{ type: "text", text: "evidence-body-4" }],
          details: {
            asset_id: "asset_1",
            node_id: "node_1",
            attempt: 1,
            media_type: "text/plain",
            size: 10,
            offset: 0,
            length: 10,
            truncated: false,
          },
        },
      }),
    ]);

    render(<GuestChat connection={CONNECTION} />);

    expect(await screen.findByRole("log", { name: "Transcript" })).toBeInTheDocument();
    expect(screen.queryByText(/evidence_read/)).not.toBeInTheDocument();
    expect(screen.queryByText(/asset_1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/evidence-body-4/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("ends the chat with one error line on a 401", async () => {
    readMock.mockResolvedValue(session([]));
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
    expect(line.closest("[data-slot=card]")).toHaveClass("border-destructive");
    expect(screen.queryByRole("combobox", { name: "Message" })).not.toBeInTheDocument();
  });
});
