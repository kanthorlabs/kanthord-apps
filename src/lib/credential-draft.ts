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
import { fieldLabel } from "./field-label";

export const OPENAI_COMPATIBLE = "openai-compatible";

export function loginModeOf(
  modes: readonly CredentialLoginMode[],
  selected: CredentialLoginMode | null,
  browserAvailable: boolean,
): CredentialLoginMode | null {
  const usable = browserAvailable ? modes : modes.filter((mode) => mode !== "browser");
  if (selected !== null && usable.includes(selected)) return selected;
  if (!modes.includes("browser")) return null;
  return usable[0] ?? null;
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
const RESERVED_NAMES: readonly string[] = ["login", "platform", "check", "ssh"];
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
  if (shape === "none") {
    return { ok: true, value: {} as CredentialSecret };
  }
  if (shape === "api_key") {
    if (isBlank(draft.key)) errors["key"] = BLANK;
    return finish(errors, { key: draft.key });
  }
  if (shape === "s3_access_key") {
    if (isBlank(draft.accessKeyId)) errors["accessKeyId"] = BLANK;
    if (isBlank(draft.secretAccessKey)) errors["secretAccessKey"] = BLANK;
    return finish(errors, {
      access_key_id: draft.accessKeyId,
      secret_access_key: draft.secretAccessKey,
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
  if (name === "base_url") return baseUrlError(value);
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
  return { base_url: fields["base_url"] ?? "", models };
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
    ...(contextWindow === undefined ? {} : { context_window: contextWindow }),
    ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
    ...(draft.reasoningLevels.length === 0
      ? {}
      : {
          reasoning_levels: REASONING_EFFORTS.filter((level) =>
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
  if (entry.secret_shape === "oauth") {
    return {
      ok: false,
      errors: { platform: "This platform takes its credential through a sign-in." },
    };
  }
  const errors: Record<string, string> = {};
  const secret = secretOfDraft(entry.secret_shape, secretDraft);
  if (!secret.ok) Object.assign(errors, secret.errors);
  const metadata =
    entry.metadata_fields.length === 0
      ? null
      : metadataOf(entry, fieldsOfDraft(entry.metadata_fields, metadataDraft, errors), []);
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
  const unchanged = entry.metadata_fields.every(
    (name) => (draft.fields[name] ?? "") === textOf(current?.[name]),
  );
  if (unchanged) return { ok: true, value: undefined };
  const errors: Record<string, string> = {};
  const fields = fieldsOfDraft(entry.metadata_fields, draft, errors);
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
    return finish(errors, { base_url: openAiMetadataOf(current).base_url, models });
  }
  if (entry.metadata_fields.length === 0) return { ok: true, value: null };
  return finish(errors, fieldsOfDraft(entry.metadata_fields, draft, errors));
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
  const contextWindow = value["context_window"];
  const maxTokens = value["max_tokens"];
  const levels = value["reasoning_levels"];
  return {
    id: value["id"],
    ...(typeof contextWindow === "number" ? { context_window: contextWindow } : {}),
    ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {}),
    ...(Array.isArray(levels) ? { reasoning_levels: levels.filter(isReasoningEffort) } : {}),
  };
}

export function openAiMetadataOf(
  metadata: Readonly<Record<string, unknown>> | null,
): OpenAiCompatibleMetadata {
  const models = Array.isArray(metadata?.["models"]) ? (metadata["models"] as unknown[]) : [];
  return {
    base_url: textOf(metadata?.["base_url"]),
    models: models.map(modelOf).filter((model): model is CredentialModel => model !== null),
  };
}

export function metadataDraftOf(
  entry: CredentialPlatformEntry,
  metadata: Readonly<Record<string, unknown>> | null,
): MetadataDraft {
  const fields = Object.fromEntries(
    entry.metadata_fields.map((name) => [name, textOf(metadata?.[name])]),
  );
  if (entry.platform !== OPENAI_COMPATIBLE) return { fields, models: [] };
  return {
    fields,
    models: openAiMetadataOf(metadata).models.map((model) => ({
      id: model.id,
      contextWindow: model.context_window === undefined ? "" : String(model.context_window),
      maxTokens: model.max_tokens === undefined ? "" : String(model.max_tokens),
      reasoningLevels: model.reasoning_levels ?? [],
    })),
  };
}

const SECRET_FIELD_LABELS: Readonly<
  Record<SecretShape, readonly (readonly [keyof SecretDraft, string])[]>
> = {
  api_key: [["key", "API Key"]],
  s3_access_key: [
    ["accessKeyId", "Access Key ID"],
    ["secretAccessKey", "Secret Access Key"],
  ],
  oauth: [],
  none: [],
};

export function missingForCredentialCheck(
  entry: CredentialPlatformEntry,
  secret: SecretDraft,
  metadata: MetadataDraft,
): readonly string[] {
  const secretMissing = SECRET_FIELD_LABELS[entry.secret_shape]
    .filter(([key]) => isBlank(secret[key]))
    .map(([, label]) => label);
  const metadataMissing = entry.metadata_fields
    .filter((name) => isBlank(metadata.fields[name] ?? ""))
    .map(fieldLabel);
  return [...secretMissing, ...metadataMissing];
}

export function missingForCredentialCreate(
  name: string,
  entry: CredentialPlatformEntry | null,
  secret: SecretDraft,
  metadata: MetadataDraft,
): readonly string[] {
  const nameMissing = isBlank(name) ? ["Name"] : [];
  if (entry === null) return [...nameMissing, "Platform"];
  return [...nameMissing, ...missingForCredentialCheck(entry, secret, metadata)];
}
