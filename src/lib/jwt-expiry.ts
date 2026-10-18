const SEGMENT_COUNT = 3;
const PAYLOAD_INDEX = 1;
const SECOND_MS = 1_000;

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function jwtExpiryOf(token: string): number | null {
  const segments = token.split(".");
  if (segments.length !== SEGMENT_COUNT) return null;
  try {
    const payload = decodeSegment(segments[PAYLOAD_INDEX] ?? "");
    if (typeof payload !== "object" || payload === null || !("exp" in payload)) return null;
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * SECOND_MS
      : null;
  } catch {
    return null;
  }
}
