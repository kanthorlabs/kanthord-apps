export type JsonTokenKind = "key" | "string" | "number" | "literal" | "plain";

export interface JsonToken {
  readonly kind: JsonTokenKind;
  readonly text: string;
}

const INDENT = 2;
const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function parsedStructure(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : undefined;
  } catch {
    return undefined;
  }
}

export function jsonTokens(text: string): readonly JsonToken[] | null {
  const value = parsedStructure(text);
  if (value === undefined) return null;
  const pretty = JSON.stringify(value, null, INDENT);
  const tokens: JsonToken[] = [];
  let cursor = 0;
  for (const match of pretty.matchAll(TOKEN)) {
    const start = match.index;
    if (start > cursor) tokens.push({ kind: "plain", text: pretty.slice(cursor, start) });
    const [whole, quoted, colon] = match;
    if (quoted !== undefined && colon !== undefined) {
      tokens.push({ kind: "key", text: quoted });
      tokens.push({ kind: "plain", text: colon });
    } else if (quoted !== undefined) {
      tokens.push({ kind: "string", text: quoted });
    } else {
      tokens.push({ kind: /^[-\d]/.test(whole) ? "number" : "literal", text: whole });
    }
    cursor = start + whole.length;
  }
  if (cursor < pretty.length) tokens.push({ kind: "plain", text: pretty.slice(cursor) });
  return tokens;
}
