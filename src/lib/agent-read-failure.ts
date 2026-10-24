import type { ApiError } from "@/api/errors";

const TEMPLATE_INVALID = "agent.prompt.template_invalid";

const REASON_TEXTS: Readonly<Record<string, string>> = {
  too_large: "it is larger than 32768 bytes",
  not_utf8: "it is not UTF-8 text",
  control_character: "it holds a control character",
  not_regular_file: "it is not a regular file",
  deadline: "the read exceeded its deadline",
  unreadable: "the server cannot read it",
  syntax: "it holds a template syntax error",
  render: "it fails to render",
};

const MESSAGE_REASONS: readonly string[] = ["syntax", "render"];

function stringField(details: unknown, key: string): string | null {
  if (typeof details !== "object" || details === null) return null;
  const value: unknown = Reflect.get(details, key);
  return typeof value === "string" ? value : null;
}

export function agentReadFailure(error: ApiError): string {
  if (error.detail !== TEMPLATE_INVALID) return error.message;
  const file = stringField(error.details, "file");
  const reason = stringField(error.details, "reason");
  if (file === null || reason === null) return error.message;
  const path = stringField(error.details, "path");
  const where = path === null ? "" : ` Path: ${path}.`;
  const parser = MESSAGE_REASONS.includes(reason) ? ` ${error.message}` : "";
  return `The prompt file ${file} is invalid: ${REASON_TEXTS[reason] ?? reason}.${parser}${where} Fix or remove the file on the server host, then retry.`;
}
