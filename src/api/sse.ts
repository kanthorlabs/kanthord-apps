export interface SseEvent {
  readonly event: string;
  readonly data: string;
}

const DEFAULT_EVENT = "message";

function nextLine(buffer: string, atEnd: boolean): { line: string; rest: string } | null {
  const end = buffer.search(/[\r\n]/);
  if (end === -1) return null;
  const terminatorLength = buffer.startsWith("\r\n", end) ? 2 : 1;
  const incompleteCrlf = buffer[end] === "\r" && end === buffer.length - 1 && !atEnd;
  if (incompleteCrlf) return null;
  return { line: buffer.slice(0, end), rest: buffer.slice(end + terminatorLength) };
}

export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  let data: string[] = [];

  const consume = function* (line: string): Generator<SseEvent> {
    if (line === "") {
      if (data.length > 0)
        yield { event: event === "" ? DEFAULT_EVENT : event, data: data.join("\n") };
      event = "";
      data = [];
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? "" : line.slice(colon + 1);
    const value = raw.startsWith(" ") ? raw.slice(1) : raw;
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  };

  try {
    for (let atEnd = false; !atEnd;) {
      const chunk = await reader.read();
      atEnd = chunk.done;
      buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      for (let next = nextLine(buffer, atEnd); next !== null; next = nextLine(buffer, atEnd)) {
        buffer = next.rest;
        yield* consume(next.line);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
