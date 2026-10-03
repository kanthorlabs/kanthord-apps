import type { Instance } from "./instance-storage";

export interface InstanceDraft {
  readonly name: string;
  readonly baseUrl: string;
}

export interface InstanceErrors {
  readonly name?: string;
  readonly baseUrl?: string;
}

export const INVALID_BASE_URL =
  "Type an absolute http or https URL, for example http://localhost:31415.";

export function normalizeBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

function nameError(name: string, others: readonly Instance[]): string | undefined {
  const trimmed = name.trim();
  if (trimmed === "") return "Type a name.";
  const key = trimmed.toLowerCase();
  if (others.some((instance) => instance.name.toLowerCase() === key)) {
    return `Another instance is already named ${trimmed}.`;
  }
  return undefined;
}

function baseUrlError(baseUrl: string | null, others: readonly Instance[]): string | undefined {
  if (baseUrl === null) return INVALID_BASE_URL;
  const twin = others.find((instance) => instance.baseUrl === baseUrl);
  if (twin !== undefined) return `The instance ${twin.name} already uses this URL.`;
  return undefined;
}

export function validateDraft(
  draft: InstanceDraft,
  others: readonly Instance[],
): { readonly errors: InstanceErrors | null; readonly baseUrl: string | null } {
  const baseUrl = normalizeBaseUrl(draft.baseUrl);
  const name = nameError(draft.name, others);
  const url = baseUrlError(baseUrl, others);
  const errors = name === undefined && url === undefined ? null : { name, baseUrl: url };
  return { errors, baseUrl };
}
