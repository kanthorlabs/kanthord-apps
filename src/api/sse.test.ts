import { describe, expect, it } from "vitest";

import { parseSse, type SseEvent } from "./sse";

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function parse(chunks: readonly string[]): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  for await (const event of parseSse(streamOf(chunks))) events.push(event);
  return events;
}

describe("parseSse", () => {
  it("parses an event with a name and a data line", async () => {
    expect(await parse(['event: state\ndata: {"run_active":true}\n\n'])).toEqual([
      { event: "state", data: '{"run_active":true}' },
    ]);
  });

  it("parses a chunk split inside a line", async () => {
    expect(await parse(["event: ent", "ries\ndat", 'a: {"a":', "1}\n\n"])).toEqual([
      { event: "entries", data: '{"a":1}' },
    ]);
  });

  it("parses a chunk split inside a CRLF pair", async () => {
    expect(await parse(["event: state\r", "\ndata: 1\r", "\n\r", "\n"])).toEqual([
      { event: "state", data: "1" },
    ]);
  });

  it("joins a multi-line data field with a newline", async () => {
    expect(await parse(["data: one\ndata: two\ndata:three\n\n"])).toEqual([
      { event: "message", data: "one\ntwo\nthree" },
    ]);
  });

  it("produces no event for a comment line", async () => {
    expect(await parse([": keepalive\n\n"])).toEqual([]);
  });

  it("skips a comment between two events", async () => {
    expect(await parse(["event: a\ndata: 1\n\n: keepalive\n\nevent: b\ndata: 2\n\n"])).toEqual([
      { event: "a", data: "1" },
      { event: "b", data: "2" },
    ]);
  });

  it("splits a multibyte character across chunks", async () => {
    const bytes = new TextEncoder().encode("data: é\n\n");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7));
        controller.enqueue(bytes.slice(7));
        controller.close();
      },
    });
    const events: SseEvent[] = [];
    for await (const event of parseSse(stream)) events.push(event);
    expect(events).toEqual([{ event: "message", data: "é" }]);
  });
});
