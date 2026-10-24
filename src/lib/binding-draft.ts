import type {
  AgentDefaultConfiguration,
  BindingPromptAgent,
  BindingPrompts,
  BindingSetEntry,
  BindingSetKind,
  RepositoryActionFollows,
  RepositoryActionName,
  RepositoryBindingConfig,
  RepositoryPlatform,
  WorkerAgentEntry,
  WorkerBindingConfig,
  WorkerPlacement,
} from "@/api/types";
import { BINDING_PROMPT_AGENTS } from "@/api/types";

export const REASONING_EFFORTS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export interface AgentEntryDraft {
  readonly agent: string;
  readonly agentProvider: string;
  readonly modelIdentifier: string;
  readonly reasoningEffort: string;
  readonly fallbackConfigurations?: readonly AgentDefaultConfiguration[];
}

export interface RepositoryDraft {
  readonly kind: "repository";
  readonly name: string;
  readonly available: boolean;
  readonly platform: RepositoryPlatform;
  readonly address: string;
  readonly baseBranch: string;
  readonly actionName: RepositoryActionName | "";
  readonly follows: RepositoryActionFollows;
  readonly sshCredential: string;
  readonly credential: string;
  readonly prompts: Readonly<Record<BindingPromptAgent, string>>;
  readonly kept: Pick<RepositoryBindingConfig, "environment" | "environment_secrets">;
}

export interface WorkerDraft {
  readonly kind: "worker";
  readonly name: string;
  readonly worker: string;
  readonly placement: WorkerPlacement | null;
  readonly instanceCount: string;
  readonly instances: readonly string[];
  readonly turns: string;
  readonly wallTimeMs: string;
  readonly entries: readonly AgentEntryDraft[];
  readonly tags: string;
  readonly environment: string;
}

export interface StorageDraft {
  readonly kind: "storage";
  readonly name: string;
  readonly available: boolean;
  readonly endpoint: string;
  readonly bucket: string;
  readonly region: string;
  readonly prefix: string;
  readonly credential: string;
}

export type BindingDraft = RepositoryDraft | WorkerDraft | StorageDraft;

export type DraftErrors = Readonly<Record<string, string>>;

export type DraftResult =
  | { readonly ok: true; readonly entry: BindingSetEntry }
  | { readonly ok: false; readonly errors: DraftErrors };

const BINDING_NAME = /^[a-z][a-z0-9-]{0,62}$/;
const REPOSITORY_ADDRESS = /^git@[A-Za-z0-9][A-Za-z0-9.-]*:[^/\s:]+\/[^/\s:]+\.git(?![\s\S])/;
const ASSESSMENT_PASSED: RepositoryActionFollows = { type: "assessment_passed" };
const REQUIRED = "Enter a value.";
const GIT_ADDRESS_HOST = /^git@([A-Za-z0-9][A-Za-z0-9.-]*):/;
const SSH_HOST_SETS: Readonly<Record<RepositoryPlatform, readonly [string, string]>> = {
  github: ["github.com", "ssh.github.com"],
  gitlab: ["gitlab.com", "altssh.gitlab.com"],
  bitbucket: ["bitbucket.org", "altssh.bitbucket.org"],
};
const PLATFORM_LABELS: Readonly<Record<RepositoryPlatform, string>> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
};

function addressPrefillOf(platform: RepositoryPlatform): string {
  return platform === "github" ? `git@${SSH_HOST_SETS.github[0]}:` : "";
}

function hostSetText(platform: RepositoryPlatform): string {
  return SSH_HOST_SETS[platform].join(" or ");
}

export function addressRuleOf(platform: RepositoryPlatform): string {
  return `Use the form git@<host>:<owner>/<repository>.git. The host must be ${hostSetText(platform)}.`;
}

function addressMissing(draft: RepositoryDraft): boolean {
  return blank(draft.address) || draft.address.trim() === addressPrefillOf(draft.platform);
}

export function pinnableHostOf(draft: {
  readonly platform: RepositoryPlatform;
  readonly address: string;
}): string | null {
  const address = draft.address.trim();
  if (!REPOSITORY_ADDRESS.test(address)) return null;
  const host = GIT_ADDRESS_HOST.exec(address)?.[1]?.toLowerCase();
  return host !== undefined && SSH_HOST_SETS[draft.platform].includes(host) ? host : null;
}

export function withPlatform(
  draft: RepositoryDraft,
  platform: RepositoryPlatform,
): RepositoryDraft {
  const actionName =
    platform !== "github" && draft.actionName === "pull_request" ? "" : draft.actionName;
  const address =
    blank(draft.address) || draft.address.trim() === addressPrefillOf(draft.platform)
      ? addressPrefillOf(platform)
      : draft.address;
  return { ...draft, platform, actionName, address };
}

function promptDraftsOf(
  prompts: BindingPrompts | undefined,
): Readonly<Record<BindingPromptAgent, string>> {
  return {
    "swe@1": prompts?.["swe@1"] ?? "",
    "re@1": prompts?.["re@1"] ?? "",
    "env@1": prompts?.["env@1"] ?? "",
  };
}

function promptsOf(draft: RepositoryDraft): BindingPrompts {
  return Object.fromEntries(
    BINDING_PROMPT_AGENTS.flatMap((agent) => {
      const text = optional(draft.prompts[agent]);
      return text === undefined ? [] : [[agent, text]];
    }),
  );
}

export function emptyDraft(kind: BindingSetKind): BindingDraft {
  if (kind === "repository") {
    return {
      kind,
      name: "",
      available: true,
      platform: "github",
      address: addressPrefillOf("github"),
      baseBranch: "main",
      actionName: "",
      follows: ASSESSMENT_PASSED,
      sshCredential: "",
      credential: "",
      prompts: promptDraftsOf(undefined),
      kept: {},
    };
  }
  if (kind === "worker") {
    return {
      kind,
      name: "",
      worker: "",
      placement: null,
      instanceCount: "1",
      instances: [],
      turns: "",
      wallTimeMs: "",
      entries: [],
      tags: "",
      environment: "",
    };
  }
  return {
    kind,
    name: "",
    available: true,
    endpoint: "",
    bucket: "",
    region: "",
    prefix: "",
    credential: "",
  };
}

export function withBindingPrompt(
  draft: RepositoryDraft,
  agent: BindingPromptAgent,
  text: string,
): RepositoryDraft {
  return { ...draft, prompts: { ...draft.prompts, [agent]: text } };
}

function agentDraftOf(entry: WorkerAgentEntry): AgentEntryDraft {
  return {
    agent: entry.agent,
    agentProvider: entry.agent_provider ?? "",
    modelIdentifier: entry.model_identifier ?? "",
    reasoningEffort: entry.reasoning_effort ?? "",
    ...(entry.fallback_configurations === undefined
      ? {}
      : { fallbackConfigurations: entry.fallback_configurations }),
  };
}

export interface AgentRow {
  readonly agent: string;
  readonly declared: boolean;
  readonly index: number | null;
}

export function agentRowsOf(
  agentNames: readonly string[],
  entries: readonly AgentEntryDraft[],
): readonly AgentRow[] {
  const indexOf = (agent: string) => {
    const index = entries.findIndex((entry) => entry.agent === agent);
    return index === -1 ? null : index;
  };
  const declared = agentNames.map((agent) => ({ agent, declared: true, index: indexOf(agent) }));
  const undeclared = entries
    .map((entry, index) => ({ agent: entry.agent, declared: false, index }))
    .filter((row) => !agentNames.includes(row.agent));
  return [...declared, ...undeclared];
}

export function withWorker(draft: WorkerDraft, worker: string): WorkerDraft {
  const name = blank(draft.name) ? (worker.split("@")[0] ?? "") : draft.name;
  return { ...draft, name, worker, placement: null, instances: [], entries: [] };
}

export function withPlacementDefault(draft: WorkerDraft, external: boolean): WorkerDraft {
  const placement = external ? null : (draft.placement ?? "server");
  return placement === draft.placement ? draft : { ...draft, placement };
}

export function withEnvironmentDefault(
  draft: WorkerDraft,
  repositoryNames: readonly string[],
): WorkerDraft {
  const [only] = repositoryNames;
  if (draft.placement !== "container" || !blank(draft.environment)) return draft;
  if (only === undefined || repositoryNames.length !== 1) return draft;
  return { ...draft, environment: only };
}

export function withWorkerPlacement(draft: WorkerDraft, atWorker: boolean): WorkerDraft {
  return { ...draft, placement: atWorker ? "worker" : "server", instances: [] };
}

export function holdsAdvancedSettings(draft: WorkerDraft): boolean {
  return (
    draft.placement === "worker" ||
    !blank(draft.turns) ||
    !blank(draft.wallTimeMs) ||
    !blank(draft.tags)
  );
}

export function advancedNeedsAttention(draft: WorkerDraft, errors: DraftErrors): boolean {
  return (
    errors["turns"] !== undefined || errors["wallTimeMs"] !== undefined || tagsInvalid(draft.tags)
  );
}

export function withAgentEntry(draft: WorkerDraft, agent: string, custom: boolean): WorkerDraft {
  const others = draft.entries.filter((entry) => entry.agent !== agent);
  return {
    ...draft,
    entries: custom
      ? [...others, { agent, agentProvider: "", modelIdentifier: "", reasoningEffort: "" }]
      : others,
  };
}

export function draftOf(name: string, entry: BindingSetEntry): BindingDraft {
  if (entry.kind === "repository") {
    const { config } = entry;
    return {
      kind: "repository",
      name,
      available: config.available,
      platform: config.platform,
      address: config.address,
      baseBranch: config.strategy.base_branch,
      actionName: config.strategy.action?.name ?? "",
      follows: config.strategy.action?.follows ?? ASSESSMENT_PASSED,
      sshCredential: config.ssh_credential,
      credential: config.credential ?? "",
      prompts: promptDraftsOf(config.prompts),
      kept: {
        ...(config.environment === undefined ? {} : { environment: config.environment }),
        ...(config.environment_secrets === undefined
          ? {}
          : { environment_secrets: config.environment_secrets }),
      },
    };
  }
  if (entry.kind === "worker") {
    const { config } = entry;
    return {
      kind: "worker",
      name,
      worker: config.worker,
      placement: config.placement ?? null,
      instanceCount: String(config.instance_count ?? 1),
      instances: config.worker_instances ?? [],
      turns: config.resource_budget === undefined ? "" : String(config.resource_budget.turns),
      wallTimeMs:
        config.resource_budget === undefined ? "" : String(config.resource_budget.wall_time_ms),
      entries: (config.entries ?? []).map(agentDraftOf),
      tags: (config.tags ?? []).join("\n"),
      environment: config.environment ?? "",
    };
  }
  return { kind: "storage", name, ...entry.config };
}

const TAG_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const TAG_MAX_BYTES = 64;

function tagsOf(text: string): readonly string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function tagsInvalid(text: string): boolean {
  const tags = tagsOf(text);
  return (
    new Set(tags).size !== tags.length ||
    tags.some(
      (tag) => !TAG_PATTERN.test(tag) || new TextEncoder().encode(tag).length > TAG_MAX_BYTES,
    )
  );
}

function blank(value: string): boolean {
  return value.trim().length === 0;
}

function wholeNumber(value: string, minimum: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
}

function nameError(name: string, takenNames: readonly string[]): string | null {
  if (!BINDING_NAME.test(name)) {
    return "Start with a lowercase letter. Use at most 63 lowercase letters, digits and hyphens.";
  }
  return takenNames.includes(name) ? "Another binding of this project uses this name." : null;
}

function optional(value: string): string | undefined {
  return blank(value) ? undefined : value.trim();
}

function agentEntryOf(draft: AgentEntryDraft): WorkerAgentEntry {
  const agentProvider = optional(draft.agentProvider);
  const modelIdentifier = optional(draft.modelIdentifier);
  const reasoningEffort = optional(draft.reasoningEffort);
  return {
    agent: draft.agent.trim(),
    ...(agentProvider === undefined ? {} : { agent_provider: agentProvider }),
    ...(modelIdentifier === undefined ? {} : { model_identifier: modelIdentifier }),
    ...(reasoningEffort === undefined ? {} : { reasoning_effort: reasoningEffort }),
    ...(draft.fallbackConfigurations === undefined
      ? {}
      : { fallback_configurations: draft.fallbackConfigurations }),
  };
}

function repositoryEntryOf(
  draft: RepositoryDraft,
  errors: Record<string, string>,
): BindingSetEntry {
  const address = draft.address.trim();
  if (!REPOSITORY_ADDRESS.test(address)) {
    errors["address"] = addressRuleOf(draft.platform);
  } else if (pinnableHostOf(draft) === null) {
    errors["address"] =
      `The host of a ${PLATFORM_LABELS[draft.platform]} address must be ${hostSetText(draft.platform)}.`;
  }
  if (blank(draft.baseBranch)) errors["baseBranch"] = REQUIRED;
  if (blank(draft.sshCredential)) errors["sshCredential"] = REQUIRED;
  if (draft.platform !== "github" && draft.actionName === "pull_request") {
    errors["actionName"] = "GitLab and Bitbucket do not support open a pull request.";
  }
  const credential = draft.platform === "github" ? draft.credential.trim() : undefined;
  if (
    draft.platform === "github" &&
    draft.actionName === "pull_request" &&
    blank(credential ?? "")
  ) {
    errors["credential"] = "Open a pull request requires a credential.";
  }
  const prompts = promptsOf(draft);
  return {
    kind: "repository",
    config: {
      available: draft.available,
      platform: draft.platform,
      address,
      strategy: {
        base_branch: draft.baseBranch.trim(),
        ...(draft.actionName === ""
          ? {}
          : { action: { name: draft.actionName, follows: draft.follows } }),
      },
      ssh_credential: draft.sshCredential.trim(),
      ...(credential !== undefined && credential !== "" ? { credential } : {}),
      ...(Object.keys(prompts).length === 0 ? {} : { prompts }),
      ...draft.kept,
    },
  };
}

export const WORKER_INSTANCES_MAX = 64;

function instancesError(
  draft: WorkerDraft,
  liveInstances: readonly string[] | null,
): string | null {
  if (new Set(draft.instances).size !== draft.instances.length) return "List each instance once.";
  if (draft.instances.length > WORKER_INSTANCES_MAX)
    return `Choose at most ${WORKER_INSTANCES_MAX} instances.`;
  const unknown =
    liveInstances === null
      ? undefined
      : draft.instances.find((instance) => !liveInstances.includes(instance));
  return unknown === undefined
    ? null
    : `${unknown} is not a live instance of ${draft.worker}. Remove it, or add it on the worker page.`;
}

function instanceFieldOf(
  draft: WorkerDraft,
  liveInstances: readonly string[] | null,
  errors: Record<string, string>,
): Pick<WorkerBindingConfig, "instance_count" | "worker_instances"> {
  if (draft.placement === "worker") {
    const invalid = instancesError(draft, liveInstances);
    if (invalid !== null) errors["instances"] = invalid;
    return { worker_instances: draft.instances };
  }
  const instanceCount = wholeNumber(draft.instanceCount, 0);
  if (instanceCount === null) errors["instanceCount"] = "Enter a whole number, 0 or more.";
  return { instance_count: instanceCount ?? 0 };
}

function workerEntryOf(
  draft: WorkerDraft,
  liveInstances: readonly string[] | null,
  errors: Record<string, string>,
): BindingSetEntry {
  if (blank(draft.worker)) errors["worker"] = REQUIRED;
  const instanceField = instanceFieldOf(draft, liveInstances, errors);
  const budgetGiven = !blank(draft.turns) || !blank(draft.wallTimeMs);
  const turns = wholeNumber(draft.turns, 1);
  const wallTimeMs = wholeNumber(draft.wallTimeMs, 1);
  if (budgetGiven && turns === null) errors["turns"] = "Enter a whole number above 0.";
  if (budgetGiven && wallTimeMs === null) errors["wallTimeMs"] = "Enter a whole number above 0.";
  draft.entries.forEach((entry, index) => {
    if (blank(entry.agent)) errors[`entries.${index}.agent`] = REQUIRED;
    const complete = !blank(entry.agentProvider);
    if (complete && blank(entry.modelIdentifier))
      errors[`entries.${index}.modelIdentifier`] =
        "A custom agent provider needs a model identifier.";
    if (complete && blank(entry.reasoningEffort))
      errors[`entries.${index}.reasoningEffort`] =
        "A custom agent provider needs a reasoning effort.";
    if (
      !complete &&
      blank(entry.modelIdentifier) &&
      blank(entry.reasoningEffort) &&
      entry.fallbackConfigurations === undefined
    )
      errors[`entries.${index}.modelIdentifier`] =
        "Give a model identifier, a reasoning effort or both. To keep the defaults, turn off the custom configuration.";
  });
  return {
    kind: "worker",
    config: {
      worker: draft.worker.trim(),
      ...instanceField,
      ...(draft.placement === null ? {} : { placement: draft.placement }),
      ...(budgetGiven && turns !== null && wallTimeMs !== null
        ? { resource_budget: { turns, wall_time_ms: wallTimeMs } }
        : {}),
      ...(draft.entries.length === 0 ? {} : { entries: draft.entries.map(agentEntryOf) }),
      ...(tagsOf(draft.tags).length === 0 ? {} : { tags: tagsOf(draft.tags) }),
      ...(draft.placement === "container" && !blank(draft.environment)
        ? { environment: draft.environment }
        : {}),
    },
  };
}

function storageEntryOf(draft: StorageDraft, errors: Record<string, string>): BindingSetEntry {
  try {
    new URL(draft.endpoint.trim());
  } catch {
    errors["endpoint"] = "Enter a full URL, for example https://s3.eu-central-1.amazonaws.com.";
  }
  if (blank(draft.bucket)) errors["bucket"] = REQUIRED;
  if (blank(draft.region)) errors["region"] = REQUIRED;
  if (blank(draft.credential)) errors["credential"] = REQUIRED;
  return {
    kind: "storage",
    config: {
      available: draft.available,
      endpoint: draft.endpoint.trim(),
      bucket: draft.bucket.trim(),
      region: draft.region.trim(),
      prefix: draft.prefix.trim(),
      credential: draft.credential.trim(),
    },
  };
}

export function entryOfDraft(
  draft: BindingDraft,
  takenNames: readonly string[],
  liveInstances: readonly string[] | null = null,
): DraftResult {
  const errors: Record<string, string> = {};
  const invalidName = nameError(draft.name, takenNames);
  if (invalidName !== null) errors["name"] = invalidName;
  const entry =
    draft.kind === "repository"
      ? repositoryEntryOf(draft, errors)
      : draft.kind === "worker"
        ? workerEntryOf(draft, liveInstances, errors)
        : storageEntryOf(draft, errors);
  return Object.keys(errors).length === 0 ? { ok: true, entry } : { ok: false, errors };
}

function labelsOf(fields: readonly (readonly [string, boolean])[]): readonly string[] {
  return fields.filter(([, missing]) => missing).map(([label]) => label);
}

export function missingForCheck(draft: RepositoryDraft): readonly string[] {
  return labelsOf([
    ["Address", addressMissing(draft)],
    ["SSH credential", blank(draft.sshCredential)],
    [
      "GitHub credential",
      draft.platform === "github" && draft.actionName === "pull_request" && blank(draft.credential),
    ],
  ]);
}

export function missingForSave(
  draft: BindingDraft,
  repositoryNames: readonly string[] = [],
): readonly string[] {
  const name: readonly [string, boolean] = ["Name", blank(draft.name)];
  if (draft.kind === "repository")
    return labelsOf([
      name,
      ["Address", addressMissing(draft)],
      ["SSH credential", blank(draft.sshCredential)],
      [
        "GitHub credential",
        draft.platform === "github" &&
          draft.actionName === "pull_request" &&
          blank(draft.credential),
      ],
      ["Base branch", blank(draft.baseBranch)],
    ]);
  if (draft.kind === "worker")
    return labelsOf([
      name,
      ["Worker", blank(draft.worker)],
      ["Instance count", draft.placement !== "worker" && blank(draft.instanceCount)],
      ["Tags", tagsInvalid(draft.tags)],
      [
        "Environment",
        draft.placement === "container" && repositoryNames.length >= 2 && blank(draft.environment),
      ],
    ]);
  return labelsOf([
    name,
    ["Endpoint", blank(draft.endpoint)],
    ["Bucket", blank(draft.bucket)],
    ["Region", blank(draft.region)],
    ["Storage credential", blank(draft.credential)],
  ]);
}
