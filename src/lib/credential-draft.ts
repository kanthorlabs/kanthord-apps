import type {
  CredentialCheckBody,
  CredentialCreateBody,
  CredentialLoginMode,
  CredentialMetadata,
  CredentialModel,
  CredentialPlatformEntry,
  CredentialSecret,
  OpenAiCompatibleMetadata,
  ReasoningEffort,
  SecretShape,
} from "@/api/types";
import { REASONING_EFFORTS } from "@/lib/binding-draft";

export const OPENAI_COMPATIBLE = "openai-compatible";

export function loginModeOf(
  modes: readonly CredentialLoginMode[],
  selected: CredentialLoginMode | null,
): CredentialLoginMode | null {
  if (selected !== null && modes.includes(selected)) return selected;
  return modes.includes("browser") ? "browser" : null;
}

export const MODEL_DEFAULT_CONTEXT_WINDOW = 128000;
export const MODEL_DEFAULT_MAX_TOKENS = 16384;

export type DraftErrors = Readonly<Record<string, string>>;

export type DraftResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: DraftErrors };

export interface SecretDraft {
  readonly key: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly refresh: string;
  readonly access: string;
  readonly expires: string;
}

export interface ModelDraft {
  readonly id: string;
  readonly contextWindow: string;
  readonly maxTokens: string;
  readonly reasoningLevels: readonly ReasoningEffort[];
}

export interface MetadataDraft {
  readonly fields: Readonly<Record<string, string>>;
  readonly models: readonly ModelDraft[];
}

export const EMPTY_SECRET: SecretDraft = {
  key: "",
  accessKeyId: "",
  secretAccessKey: "",
  refresh: "",
  access: "",
  expires: "",
};

export const EMPTY_METADATA: MetadataDraft = {
  fields: {},
  models: [],
};

export const EMPTY_MODEL: ModelDraft = {
  id: "",
  contextWindow: "",
  maxTokens: "",
  reasoningLevels: [],
};

const CREDENTIAL_NAME = /^[a-z][a-z0-9-]*$/;
const NAME_MAX_LENGTH = 63;
const RESERVED_NAMES: readonly string[] = ["login", "platform", "check"];
const BASE_URL = /^https?:\/\/[^?#]+[^?#/]$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const INTEGER = /^-?[0-9]+$/;
const BLANK = "Enter a value.";

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function credentialNameError(name: string): string | null {
  if (name.length === 0) return "Enter a name.";
  if (name.length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters.`;
  if (!CREDENTIAL_NAME.test(name)) {
    return "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.";
  }
  if (RESERVED_NAMES.includes(name)) return `The name ${name} is reserved. Choose another name.`;
  return null;
}

export function secretOfDraft(
  shape: SecretShape,
  draft: SecretDraft,
): DraftResult<CredentialSecret> {
  const errors: Record<string, string> = {};
  if (shape === "api_key") {
    if (isBlank(draft.key)) errors["key"] = BLANK;
    return finish(errors, { key: draft.key });
  }
  if (shape === "s3_access_key") {
    if (isBlank(draft.accessKeyId)) errors["accessKeyId"] = BLANK;
    if (isBlank(draft.secretAccessKey)) errors["secretAccessKey"] = BLANK;
    return finish(errors, {
      accessKeyId: draft.accessKeyId,
      secretAccessKey: draft.secretAccessKey,
    });
  }
  if (draft.refresh.length === 0) errors["refresh"] = BLANK;
  if (draft.access.length === 0) errors["access"] = BLANK;
  const expires = Number(draft.expires);
  if (!INTEGER.test(draft.expires) || !Number.isSafeInteger(expires)) {
    errors["expires"] = "Enter the expiry as Unix milliseconds.";
  }
  return finish(errors, { refresh: draft.refresh, access: draft.access, expires });
}

function finish<T>(errors: Record<string, string>, value: T): DraftResult<T> {
  return Object.keys(errors).length === 0 ? { ok: true, value } : { ok: false, errors };
}

function baseUrlError(baseUrl: string): string | null {
  return BASE_URL.test(baseUrl)
    ? null
    : "Use an http or https address with no query, no fragment and no trailing slash.";
}

function fieldError(name: string, value: string): string | null {
  if (name === "baseUrl") return baseUrlError(value);
  if (name === "endpoint" && !URL.canParse(value)) {
    return "Enter a full URL, for example https://s3.amazonaws.com.";
  }
  return isBlank(value) ? BLANK : null;
}

function fieldsOfDraft(
  names: readonly string[],
  draft: MetadataDraft,
  errors: Record<string, string>,
): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {};
  for (const name of names) {
    const value = draft.fields[name] ?? "";
    const invalid = fieldError(name, value);
    if (invalid !== null) errors[name] = invalid;
    fields[name] = value;
  }
  return fields;
}

function metadataOf(
  entry: CredentialPlatformEntry,
  fields: Readonly<Record<string, string>>,
  models: readonly CredentialModel[],
): CredentialMetadata {
  if (entry.platform !== OPENAI_COMPATIBLE) return fields;
  return { baseUrl: fields["baseUrl"] ?? "", models };
}

function limitOf(value: string, key: string, errors: Record<string, string>): number | undefined {
  if (value.length === 0) return undefined;
  if (!POSITIVE_INTEGER.test(value) || !Number.isSafeInteger(Number(value))) {
    errors[key] = "Enter a positive whole number, or leave it empty.";
    return undefined;
  }
  return Number(value);
}

function modelOfDraft(
  draft: ModelDraft,
  index: number,
  errors: Record<string, string>,
): CredentialModel {
  const prefix = `models.${index}`;
  if (isBlank(draft.id)) errors[`${prefix}.id`] = BLANK;
  const contextWindow = limitOf(draft.contextWindow, `${prefix}.contextWindow`, errors);
  const maxTokens = limitOf(draft.maxTokens, `${prefix}.maxTokens`, errors);
  if ((maxTokens ?? MODEL_DEFAULT_MAX_TOKENS) > (contextWindow ?? MODEL_DEFAULT_CONTEXT_WINDOW)) {
    errors[`${prefix}.maxTokens`] = "Use at most the context window.";
  }
  return {
    id: draft.id,
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(draft.reasoningLevels.length === 0
      ? {}
      : {
          reasoningLevels: REASONING_EFFORTS.filter((level) =>
            draft.reasoningLevels.includes(level),
          ),
        }),
  };
}

export function checkBodyOf(
  entry: CredentialPlatformEntry,
  secretDraft: SecretDraft,
  metadataDraft: MetadataDraft,
): DraftResult<CredentialCheckBody> {
  if (entry.secretShape === "oauth") {
    return {
      ok: false,
      errors: { platform: "This platform takes its credential through a sign-in." },
    };
  }
  const errors: Record<string, string> = {};
  const secret = secretOfDraft(entry.secretShape, secretDraft);
  if (!secret.ok) Object.assign(errors, secret.errors);
  const metadata =
    entry.metadataFields.length === 0
      ? null
      : metadataOf(entry, fieldsOfDraft(entry.metadataFields, metadataDraft, errors), []);
  if (!secret.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      platform: entry.platform,
      metadata,
      secret: secret.value as CredentialCheckBody["secret"],
    },
  };
}

export function createBodyOf(
  name: string,
  entry: CredentialPlatformEntry,
  secretDraft: SecretDraft,
  metadataDraft: MetadataDraft,
): DraftResult<CredentialCreateBody> {
  const nameError = credentialNameError(name);
  const body = checkBodyOf(entry, secretDraft, metadataDraft);
  if (!body.ok) {
    return {
      ok: false,
      errors: nameError === null ? body.errors : { name: nameError, ...body.errors },
    };
  }
  if (nameError !== null) return { ok: false, errors: { name: nameError } };
  return { ok: true, value: { name, ...body.value } };
}

export function rotateMetadataOf(
  entry: CredentialPlatformEntry,
  current: Readonly<Record<string, unknown>> | null,
  draft: MetadataDraft,
): DraftResult<CredentialMetadata | undefined> {
  const unchanged = entry.metadataFields.every(
    (name) => (draft.fields[name] ?? "") === textOf(current?.[name]),
  );
  if (unchanged) return { ok: true, value: undefined };
  const errors: Record<string, string> = {};
  const fields = fieldsOfDraft(entry.metadataFields, draft, errors);
  return finish(errors, metadataOf(entry, fields, openAiMetadataOf(current).models));
}

function flagRepeatedModelIds(models: readonly ModelDraft[], errors: Record<string, string>): void {
  const seen = new Set<string>();
  models.forEach((model, index) => {
    const id = model.id.trim();
    if (id.length === 0) return;
    if (seen.has(id)) errors[`models.${index}.id`] = "Use an id that no other model uses.";
    seen.add(id);
  });
}

export function editMetadataOf(
  entry: CredentialPlatformEntry,
  current: Readonly<Record<string, unknown>> | null,
  draft: MetadataDraft,
): DraftResult<CredentialMetadata> {
  const errors: Record<string, string> = {};
  if (entry.platform === OPENAI_COMPATIBLE) {
    const models = draft.models.map((model, index) => modelOfDraft(model, index, errors));
    flagRepeatedModelIds(draft.models, errors);
    return finish(errors, { baseUrl: openAiMetadataOf(current).baseUrl, models });
  }
  if (entry.metadataFields.length === 0) return { ok: true, value: null };
  return finish(errors, fieldsOfDraft(entry.metadataFields, draft, errors));
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return (REASONING_EFFORTS as readonly unknown[]).includes(value);
}

function modelOf(value: unknown): CredentialModel | null {
  if (!isRecord(value) || typeof value["id"] !== "string") return null;
  const contextWindow = value["contextWindow"];
  const maxTokens = value["maxTokens"];
  const levels = value["reasoningLevels"];
  return {
    id: value["id"],
    ...(typeof contextWindow === "number" ? { contextWindow } : {}),
    ...(typeof maxTokens === "number" ? { maxTokens } : {}),
    ...(Array.isArray(levels) ? { reasoningLevels: levels.filter(isReasoningEffort) } : {}),
  };
}

export function openAiMetadataOf(
  metadata: Readonly<Record<string, unknown>> | null,
): OpenAiCompatibleMetadata {
  const models = Array.isArray(metadata?.["models"]) ? (metadata["models"] as unknown[]) : [];
  return {
    baseUrl: textOf(metadata?.["baseUrl"]),
    models: models.map(modelOf).filter((model): model is CredentialModel => model !== null),
  };
}

export function metadataDraftOf(
  entry: CredentialPlatformEntry,
  metadata: Readonly<Record<string, unknown>> | null,
): MetadataDraft {
  const fields = Object.fromEntries(
    entry.metadataFields.map((name) => [name, textOf(metadata?.[name])]),
  );
  if (entry.platform !== OPENAI_COMPATIBLE) return { fields, models: [] };
  return {
    fields,
    models: openAiMetadataOf(metadata).models.map((model) => ({
      id: model.id,
      contextWindow: model.contextWindow === undefined ? "" : String(model.contextWindow),
      maxTokens: model.maxTokens === undefined ? "" : String(model.maxTokens),
      reasoningLevels: model.reasoningLevels ?? [],
    })),
  };
}
