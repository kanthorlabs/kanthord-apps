import type {
  BindingSetEntry,
  BindingSetKind,
  RepositoryActionFollows,
  RepositoryActionName,
  RepositoryPlatform,
  WorkerAgentEntry,
} from "@/api/types";

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
  readonly sshCredentialHost: string;
  readonly credential: string;
  readonly projectPrompt: string;
}

export interface WorkerDraft {
  readonly kind: "worker";
  readonly name: string;
  readonly worker: string;
  readonly instanceCount: string;
  readonly turns: string;
  readonly wallTimeMs: string;
  readonly entries: readonly AgentEntryDraft[];
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

export function emptyDraft(kind: BindingSetKind): BindingDraft {
  if (kind === "repository") {
    return {
      kind,
      name: "",
      available: true,
      platform: "github",
      address: "",
      baseBranch: "main",
      actionName: "",
      follows: ASSESSMENT_PASSED,
      sshCredential: "",
      sshCredentialHost: "",
      credential: "",
      projectPrompt: "",
    };
  }
  if (kind === "worker") {
    return {
      kind,
      name: "",
      worker: "",
      instanceCount: "1",
      turns: "",
      wallTimeMs: "",
      entries: [],
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

function agentDraftOf(entry: WorkerAgentEntry): AgentEntryDraft {
  return {
    agent: entry.agent,
    agentProvider: entry.agent_provider ?? "",
    modelIdentifier: entry.model_identifier ?? "",
    reasoningEffort: entry.reasoning_effort ?? "",
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
      sshCredentialHost: "",
      credential: config.credential ?? "",
      projectPrompt: config.project_prompt ?? "",
    };
  }
  if (entry.kind === "worker") {
    const { config } = entry;
    return {
      kind: "worker",
      name,
      worker: config.worker,
      instanceCount: String(config.instance_count),
      turns: config.resource_budget === undefined ? "" : String(config.resource_budget.turns),
      wallTimeMs:
        config.resource_budget === undefined ? "" : String(config.resource_budget.wall_time_ms),
      entries: (config.entries ?? []).map(agentDraftOf),
    };
  }
  return { kind: "storage", name, ...entry.config };
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
  };
}

function addressHostOf(address: string): string | null {
  const match = GIT_ADDRESS_HOST.exec(address);
  return match?.[1] ?? null;
}

function repositoryEntryOf(
  draft: RepositoryDraft,
  errors: Record<string, string>,
): BindingSetEntry {
  const address = draft.address.trim();
  if (!REPOSITORY_ADDRESS.test(address)) {
    errors["address"] =
      "An SSH address git@<host>:<owner>/<repository>.git. The host must equal the host of the SSH credential.";
  } else if (draft.sshCredentialHost !== "") {
    const addressHost = addressHostOf(address);
    if (addressHost !== null && addressHost !== draft.sshCredentialHost) {
      errors["address"] =
        `The address host must equal the SSH credential host ${draft.sshCredentialHost}.`;
    }
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
  const projectPrompt = optional(draft.projectPrompt);
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
      ...(projectPrompt === undefined ? {} : { project_prompt: projectPrompt }),
    },
  };
}

function workerEntryOf(draft: WorkerDraft, errors: Record<string, string>): BindingSetEntry {
  if (blank(draft.worker)) errors["worker"] = REQUIRED;
  const instanceCount = wholeNumber(draft.instanceCount, 0);
  if (instanceCount === null) errors["instanceCount"] = "Enter a whole number, 0 or more.";
  const budgetGiven = !blank(draft.turns) || !blank(draft.wallTimeMs);
  const turns = wholeNumber(draft.turns, 1);
  const wallTimeMs = wholeNumber(draft.wallTimeMs, 1);
  if (budgetGiven && turns === null) errors["turns"] = "Enter a whole number above 0.";
  if (budgetGiven && wallTimeMs === null) errors["wallTimeMs"] = "Enter a whole number above 0.";
  draft.entries.forEach((entry, index) => {
    if (blank(entry.agent)) errors[`entries.${index}.agent`] = REQUIRED;
  });
  return {
    kind: "worker",
    config: {
      worker: draft.worker.trim(),
      instance_count: instanceCount ?? 0,
      ...(budgetGiven && turns !== null && wallTimeMs !== null
        ? { resource_budget: { turns, wall_time_ms: wallTimeMs } }
        : {}),
      ...(draft.entries.length === 0 ? {} : { entries: draft.entries.map(agentEntryOf) }),
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

export function entryOfDraft(draft: BindingDraft, takenNames: readonly string[]): DraftResult {
  const errors: Record<string, string> = {};
  const invalidName = nameError(draft.name, takenNames);
  if (invalidName !== null) errors["name"] = invalidName;
  const entry =
    draft.kind === "repository"
      ? repositoryEntryOf(draft, errors)
      : draft.kind === "worker"
        ? workerEntryOf(draft, errors)
        : storageEntryOf(draft, errors);
  return Object.keys(errors).length === 0 ? { ok: true, entry } : { ok: false, errors };
}

function labelsOf(fields: readonly (readonly [string, boolean])[]): readonly string[] {
  return fields.filter(([, missing]) => missing).map(([label]) => label);
}

export function missingForCheck(draft: RepositoryDraft): readonly string[] {
  return labelsOf([
    ["Address", blank(draft.address)],
    ["SSH credential", blank(draft.sshCredential)],
    [
      "GitHub credential",
      draft.platform === "github" && draft.actionName === "pull_request" && blank(draft.credential),
    ],
  ]);
}

export function missingForSave(draft: BindingDraft): readonly string[] {
  const name: readonly [string, boolean] = ["Name", blank(draft.name)];
  if (draft.kind === "repository")
    return labelsOf([
      name,
      ["Address", blank(draft.address)],
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
      ["Instance count", blank(draft.instanceCount)],
    ]);
  return labelsOf([
    name,
    ["Endpoint", blank(draft.endpoint)],
    ["Bucket", blank(draft.bucket)],
    ["Region", blank(draft.region)],
    ["Storage credential", blank(draft.credential)],
  ]);
}
