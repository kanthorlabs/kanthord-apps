import type { Instance, SavedInstance } from "./instance-storage";

export interface InstanceDraft {
  readonly name: string;
  readonly baseUrl: string;
  readonly token: string;
}

export interface InstanceErrors {
  readonly name?: string;
  readonly baseUrl?: string;
  readonly token?: string;
}

export type InstanceFields = Omit<SavedInstance, "id">;

export interface Validated {
  readonly errors: InstanceErrors | null;
  readonly fields: InstanceFields | null;
}

export interface ValidatedSignIn extends Validated {
  readonly id: string | null;
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
  const key = name.toLowerCase();
  if (others.some((instance) => instance.name.toLowerCase() === key)) {
    return `Another instance is already named ${name}.`;
  }
  return undefined;
}

function baseUrlError(baseUrl: string | null, others: readonly Instance[]): string | undefined {
  if (baseUrl === null) return INVALID_BASE_URL;
  const twin = others.find((instance) => instance.baseUrl === baseUrl);
  if (twin !== undefined) return `The instance ${twin.name} already uses this URL.`;
  return undefined;
}

function validate(draft: InstanceDraft, others: readonly Instance[]): Validated {
  const baseUrl = normalizeBaseUrl(draft.baseUrl);
  const name = draft.name.trim() === "" ? (baseUrl ?? "") : draft.name.trim();
  const token = draft.token.trim();
  const errors: InstanceErrors = {
    name: baseUrl === null ? undefined : nameError(name, others),
    baseUrl: baseUrlError(baseUrl, others),
    token: token === "" ? "Paste a token." : undefined,
  };
  if (errors.name !== undefined || errors.baseUrl !== undefined || errors.token !== undefined) {
    return { errors, fields: null };
  }
  return { errors: null, fields: { name, baseUrl: baseUrl ?? "", token } };
}

export function validateEdit(
  draft: InstanceDraft,
  instances: readonly Instance[],
  id: string,
): Validated {
  return validate(
    draft,
    instances.filter((instance) => instance.id !== id),
  );
}

export function validateSignIn(
  draft: InstanceDraft,
  instances: readonly Instance[],
): ValidatedSignIn {
  const baseUrl = normalizeBaseUrl(draft.baseUrl);
  const twin = instances.find((instance) => instance.baseUrl === baseUrl) ?? null;
  const others = instances.filter((instance) => instance !== twin);
  return { ...validate(draft, others), id: twin?.id ?? null };
}
