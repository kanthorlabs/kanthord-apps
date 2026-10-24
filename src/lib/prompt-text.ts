export const PROMPT_TEXT_MAX_BYTES = 32768;

type PromptTextProblem = "too_large" | "control_character";

const PROBLEM_MESSAGES: Readonly<Record<PromptTextProblem, string>> = {
  too_large: "The text is above the limit.",
  control_character:
    "The text holds a control character. Remove it. Only tab and line feed are allowed.",
};

const encoder = new TextEncoder();
const TAB = 9;
const LINE_FEED = 10;
const FIRST_PRINTABLE = 32;
const DELETE = 127;

export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

function holdsControlCharacter(text: string): boolean {
  return Array.from(text, (character) => character.charCodeAt(0)).some(
    (code) => (code < FIRST_PRINTABLE && code !== TAB && code !== LINE_FEED) || code === DELETE,
  );
}

export function byteUsage(text: string): string {
  return `${utf8Bytes(text).toLocaleString("en-US")} / ${PROMPT_TEXT_MAX_BYTES.toLocaleString("en-US")} bytes`;
}

export function promptTextProblem(text: string): string | null {
  if (utf8Bytes(text) > PROMPT_TEXT_MAX_BYTES) return PROBLEM_MESSAGES.too_large;
  return holdsControlCharacter(text) ? PROBLEM_MESSAGES.control_character : null;
}
