export const PROMPT_TEXT_MAX_BYTES = 32768;

export type PromptSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly conflict: boolean };

const encoder = new TextEncoder();

export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

export function byteUsage(text: string): string {
  return `${utf8Bytes(text).toLocaleString("en-US")} / ${PROMPT_TEXT_MAX_BYTES.toLocaleString("en-US")} bytes`;
}
