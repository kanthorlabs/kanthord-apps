import type { ApiError } from "./errors";

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

function parserMessage(message: string, template: string | null): string {
  const lead = template === null ? "" : `Prompt template ${template} is invalid: `;
  const text = message.startsWith(lead) ? message.slice(lead.length) : message;
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

export function agentReadFailure(error: ApiError): string {
  if (error.detail !== TEMPLATE_INVALID) return error.message;
  const file = stringField(error.details, "file");
  const reason = stringField(error.details, "reason");
  if (file === null || reason === null) return error.message;
  const path = stringField(error.details, "path");
  const where = path === null ? "" : ` Path: ${path}.`;
  const template = stringField(error.details, "template");
  const parser = MESSAGE_REASONS.includes(reason)
    ? ` ${parserMessage(error.message, template)}`
    : "";
  return `The prompt file ${file} is invalid: ${REASON_TEXTS[reason] ?? reason}.${parser}${where} Fix or remove the file on the server host, then retry.`;
}
