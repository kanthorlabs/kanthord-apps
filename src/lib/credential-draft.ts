import type {
  CredentialCreateBody,
  CredentialMetadata,
  CredentialModel,
  CredentialPlatform,
  CredentialSecret,
  OpenAiCompatibleMetadata,
  ReasoningEffort,
  S3Metadata,
  SecretShape,
} from "@/api/types";
import { REASONING_EFFORTS } from "@/lib/binding-draft";

export const SECRET_SHAPES: Readonly<Record<CredentialPlatform, SecretShape>> = {
  github: "api_key",
  "github-copilot": "oauth",
  "openai-codex": "oauth",
  anthropic: "api_key",
  openrouter: "api_key",
  "openai-compatible": "api_key",
  s3: "s3_access_key",
};

export function isOAuthPlatform(platform: CredentialPlatform): boolean {
  return SECRET_SHAPES[platform] === "oauth";
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
  readonly baseUrl: string;
  readonly endpoint: string;
  readonly bucket: string;
  readonly region: string;
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
  baseUrl: "",
  endpoint: "",
  bucket: "",
  region: "",
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
const RESERVED_NAME = "login";
const BASE_URL = /^https?:\/\/[^?#]+[^?#/]$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const INTEGER = /^-?[0-9]+$/;
const BLANK = "Enter a value.";

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function hasMetadata(platform: CredentialPlatform): boolean {
  return platform === "openai-compatible" || platform === "s3";
}

export function credentialNameError(name: string): string | null {
  if (name.length === 0) return "Enter a name.";
  if (name.length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters.`;
  if (!CREDENTIAL_NAME.test(name)) {
    return "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.";
  }
  if (name === RESERVED_NAME) return "The name login is reserved. Choose another name.";
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

function s3MetadataOfDraft(draft: MetadataDraft, errors: Record<string, string>): S3Metadata {
  if (!URL.canParse(draft.endpoint))
    errors["endpoint"] = "Enter a full URL, for example https://s3.amazonaws.com.";
  if (isBlank(draft.bucket)) errors["bucket"] = BLANK;
  if (isBlank(draft.region)) errors["region"] = BLANK;
  return { endpoint: draft.endpoint, bucket: draft.bucket, region: draft.region };
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

export function createBodyOf(
  name: string,
  platform: CredentialPlatform,
  secretDraft: SecretDraft,
  metadataDraft: MetadataDraft,
): DraftResult<CredentialCreateBody> {
  const errors: Record<string, string> = {};
  const nameError = credentialNameError(name);
  if (nameError !== null) errors["name"] = nameError;
  if (isOAuthPlatform(platform)) {
    return {
      ok: false,
      errors: { ...errors, platform: "This platform takes its credential through a sign-in." },
    };
  }
  const secret = secretOfDraft(SECRET_SHAPES[platform], secretDraft);
  if (!secret.ok) Object.assign(errors, secret.errors);
  let metadata: CredentialMetadata = null;
  if (platform === "openai-compatible") {
    const invalid = baseUrlError(metadataDraft.baseUrl);
    if (invalid !== null) errors["baseUrl"] = invalid;
    metadata = { baseUrl: metadataDraft.baseUrl, models: [] };
  }
  if (platform === "s3") metadata = s3MetadataOfDraft(metadataDraft, errors);
  if (!secret.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, platform, metadata, secret: secret.value as CredentialCreateBody["secret"] },
  };
}

export function rotateMetadataOf(
  platform: CredentialPlatform,
  current: Readonly<Record<string, unknown>> | null,
  draft: MetadataDraft,
): DraftResult<CredentialMetadata | undefined> {
  const errors: Record<string, string> = {};
  if (platform === "openai-compatible") {
    const existing = openAiMetadataOf(current);
    if (draft.baseUrl === existing.baseUrl) return { ok: true, value: undefined };
    const invalid = baseUrlError(draft.baseUrl);
    if (invalid !== null) errors["baseUrl"] = invalid;
    return finish(errors, { baseUrl: draft.baseUrl, models: existing.models });
  }
  if (platform === "s3") {
    const existing = s3MetadataOf(current);
    const next = s3MetadataOfDraft(draft, errors);
    const unchanged =
      next.endpoint === existing.endpoint &&
      next.bucket === existing.bucket &&
      next.region === existing.region;
    if (unchanged) return { ok: true, value: undefined };
    return finish(errors, next);
  }
  return { ok: true, value: undefined };
}

export function editMetadataOf(
  platform: CredentialPlatform,
  current: Readonly<Record<string, unknown>> | null,
  draft: MetadataDraft,
): DraftResult<CredentialMetadata> {
  const errors: Record<string, string> = {};
  if (platform === "openai-compatible") {
    const models = draft.models.map((model, index) => modelOfDraft(model, index, errors));
    return finish(errors, { baseUrl: openAiMetadataOf(current).baseUrl, models });
  }
  if (platform === "s3") return finish(errors, s3MetadataOfDraft(draft, errors));
  return { ok: true, value: null };
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

export function s3MetadataOf(metadata: Readonly<Record<string, unknown>> | null): S3Metadata {
  return {
    endpoint: textOf(metadata?.["endpoint"]),
    bucket: textOf(metadata?.["bucket"]),
    region: textOf(metadata?.["region"]),
  };
}

export function metadataDraftOf(
  platform: CredentialPlatform,
  metadata: Readonly<Record<string, unknown>> | null,
): MetadataDraft {
  if (platform === "openai-compatible") {
    const current = openAiMetadataOf(metadata);
    return {
      ...EMPTY_METADATA,
      baseUrl: current.baseUrl,
      models: current.models.map((model) => ({
        id: model.id,
        contextWindow: model.contextWindow === undefined ? "" : String(model.contextWindow),
        maxTokens: model.maxTokens === undefined ? "" : String(model.maxTokens),
        reasoningLevels: model.reasoningLevels ?? [],
      })),
    };
  }
  if (platform === "s3") return { ...EMPTY_METADATA, ...s3MetadataOf(metadata) };
  return EMPTY_METADATA;
}
