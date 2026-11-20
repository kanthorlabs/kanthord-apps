import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as fx from "../mock/fixtures.mjs";
import { makeClient, startMock, stopMock } from "./mock-harness.mjs";

const POLL_ATTEMPTS = 300;
const POLL_INTERVAL_MS = 50;
const SCENARIO_TIMEOUT_MS = 30000;

let mock;
let client;

const answerOf = async (step, request) => {
  const answer = await request.catch((error) => {
    throw new Error(`step ${step}: ${error.message}`);
  });
  expect(answer.problems, `step ${step}`).toEqual([]);
  return answer;
};

const untilAnswer = async (step, path, isDone) => {
  let last = null;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    last = await answerOf(step, client.call("GET", path));
    if (isDone(last.body)) return last.body;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Step ${step} timed out. Last answer: ${JSON.stringify(last)}`);
};

beforeAll(async () => {
  mock = await startMock();
  client = makeClient(mock);
}, 20000);

afterAll(async () => {
  if (mock !== undefined) await stopMock(mock);
});

describe("main Workbench scenario on the mock", () => {
  let sessionId;

  it(
    "creates a conversation, waits on a tool approval and finishes the run after the approval",
    async () => {
      const created = await answerOf(
        1,
        client.call("POST", "/api/workbench/session", {
          body: {
            agent_provider: "atlas-llm",
            model_identifier: "qwen3-coder",
            reasoning_effort: "off",
            agent_name: "ops@1",
          },
        }),
      );
      expect(created.status).toBe(200);
      sessionId = created.body.id;
      const session = `/api/workbench/session/${sessionId}`;

      const message = await answerOf(
        2,
        client.call("POST", `${session}/message`, {
          body: { text: "create the project account-recovery" },
        }),
      );
      expect(message.status).toBe(202);

      const waiting = await untilAnswer(
        3,
        `${session}/events`,
        (body) => body.snapshot?.pending_approval != null,
      );
      const toolCallId = waiting.snapshot.pending_approval.tool_call_id;

      const listed = await answerOf(4, client.call("GET", "/api/workbench/session"));
      expect(listed.body.items.find((item) => item.id === sessionId)).toMatchObject({
        run_active: true,
        pending_approval: { tool_call_id: toolCallId },
      });

      const approved = await answerOf(
        5,
        client.call("POST", `${session}/approve`, {
          body: { tool_call_id: toolCallId, approved: true },
        }),
      );
      expect(approved.status).toBe(200);

      const finished = await untilAnswer(
        6,
        `${session}/events`,
        (body) => body.snapshot?.run_active === false,
      );
      expect(
        finished.entries.some(
          (entry) =>
            entry.message?.role === "toolResult" && entry.message.toolCallId === toolCallId,
        ),
      ).toBe(true);
    },
    SCENARIO_TIMEOUT_MS,
  );

  it(
    "shares the conversation, joins as a guest and sends a run message and a note",
    async () => {
      const invite = await answerOf(
        7,
        client.call("POST", `/api/workbench/session/${sessionId}/invite`, {
          body: {
            invitee_name: "Mara",
            project_ids: [fx.PROJECT.id],
            granted_operations: ["mission.node.pause"],
          },
        }),
      );
      const joined = await answerOf(
        7,
        client.call("POST", "/api/workbench/invite/join", {
          token: null,
          body: { invite_token: invite.body.invite_token, name: "Mara" },
        }),
      );
      const guest = { token: joined.body.guest_token };

      const read = await answerOf(8, client.call("GET", "/api/workbench/guest/session", guest));
      expect(read.body.mention_names.length).toBeGreaterThan(0);

      const run = await answerOf(
        9,
        client.call("POST", "/api/workbench/guest/session/message", {
          ...guest,
          body: { text: `@${read.body.mention_names[0]} status?` },
        }),
      );
      expect(run.status).toBe(202);
      expect(run.body.kind).toBe("run");
      const note = await answerOf(
        9,
        client.call("POST", "/api/workbench/guest/session/message", {
          ...guest,
          body: { text: "Thanks for the update." },
        }),
      );
      expect(note.status).toBe(202);
      expect(note.body.kind).toBe("note");
    },
    SCENARIO_TIMEOUT_MS,
  );
});
