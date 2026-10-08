/**
 * The daemon contract.
 *
 * Derived from the kanthord design set: overview.md, architecture.md,
 * project-service.md, mission-service.md, scheduler-service.md and
 * worker-service.md, together with their vocabulary siblings.
 */

export type NodeKind = "initiative" | "objective" | "task";

export const NODE_STATES = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Evaluating",
  "Blocked",
  "Paused",
  "Completed",
  "Discarded",
  "External.Requested",
  "External.Success",
  "External.Failed",
] as const;

export type NodeState = (typeof NODE_STATES)[number];

export interface HumanIdentity {
  readonly kind: "human";
  readonly sub: string;
  readonly name: string;
}

export type ComponentCode = 200 | 503;

export type ServiceMaps = Readonly<Record<string, Readonly<Record<string, ComponentCode>>>>;

export interface LivenessReport {
  readonly healthy: boolean;
  readonly services: ServiceMaps;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly binding_set_version: number;
  readonly created_at: number;
  readonly workspace_directory: string;
}

/** Why a node is not running. The Scheduler rechecks each of these at the claim. */
export type WorkerHost = "kanthord" | "external-harness";

export type InstanceActivity = "idle" | "pulling" | "executing";

export interface WorkerCatalogItem {
  readonly name: string;
  readonly host: WorkerHost;
  readonly declared_node_states: readonly string[];
  readonly required_node_format: readonly string[];
}

export interface WorkerResourceBudget {
  readonly wall_time_ms: number;
  readonly turns?: number;
}

export type WorkerMethod = "steps" | "evaluation" | "reviewed_steps";

export type WorkerCatalogEntry =
  | (WorkerCatalogItem & {
      readonly host: "kanthord";
      readonly method: WorkerMethod;
      readonly agent_names: readonly string[];
      readonly resource_budget: WorkerResourceBudget;
    })
  | (WorkerCatalogItem & {
      readonly host: "external-harness";
      readonly harness: string;
      readonly resource_budget: WorkerResourceBudget;
    });

interface WorkerInstanceBase {
  readonly runtime_identity: string;
  readonly project_id: string;
  readonly resource_identity: string;
  readonly worker_name: string;
  readonly client_id?: string;
  readonly name?: string;
  readonly activity: InstanceActivity;
  readonly draining: boolean;
  readonly execution_id?: string;
  readonly registered: boolean;
}

export type WorkerInstanceRecord =
  | (WorkerInstanceBase & { readonly host: "kanthord"; readonly placement: "server" | "worker" })
  | (WorkerInstanceBase & { readonly host: "external-harness" });

export type AgentEnablementState = "enabled" | "disabled";

export const AGENT_PROVIDER_KINDS = [
  "github-copilot",
  "openai-codex",
  "anthropic",
  "openai-compatible",
  "openrouter",
] as const;

export type AgentProviderKind = (typeof AGENT_PROVIDER_KINDS)[number];

export type ReasoningEffort = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface AgentProvider {
  readonly name: string;
  readonly provider: AgentProviderKind;
  readonly credential: string;
}

export interface AgentDefaultConfiguration {
  readonly agent_provider: string;
  readonly model_identifier: string;
  readonly reasoning_effort: ReasoningEffort;
}

export interface AgentEnablement {
  readonly agent_name: string;
  readonly state: AgentEnablementState;
  readonly agent_providers: readonly AgentProvider[];
  readonly default_configuration: AgentDefaultConfiguration;
  readonly revision: number;
}

export interface AgentModel {
  readonly model_identifier: string;
  readonly reasoning_efforts: readonly ReasoningEffort[];
}

export interface AgentProviderAddBody extends AgentProvider {
  readonly expected_revision: number;
}

export interface AgentEnablementPutBody {
  readonly expected_revision?: number;
  readonly agent_providers: readonly AgentProvider[];
  readonly default_configuration: AgentDefaultConfiguration;
}

export interface AgentSummary {
  readonly agentName: string;
  readonly workerNames: readonly string[];
  readonly enablement: AgentEnablement | null;
}

export type AgentToolSource = "builtin" | "kanthord-mcp" | "host";

export interface AgentTool {
  readonly name: string;
  readonly source: AgentToolSource;
  readonly input_schema: Readonly<Record<string, unknown>>;
}

export type PromptOrigin = "binary" | "file" | "database";

export type PromptSourceState = "present" | "absent" | "invalid" | "off" | "deferred";

export type PromptLayerKind = "system" | "agent" | "working";

export interface PromptSource {
  readonly source: string;
  readonly origin: PromptOrigin;
  readonly path: string | null;
  readonly enabled: boolean;
  readonly state: PromptSourceState;
  readonly digest: string | null;
  readonly text: string | null;
}

export interface PromptLayer {
  readonly layer: PromptLayerKind;
  readonly enabled: boolean;
  readonly sources: readonly PromptSource[];
}

export type PromptScope = "system" | "agent" | "workbench";

export const SYSTEM_LAYER_OVERRIDES = ["inherit", "on", "off"] as const;
export type SystemLayerOverride = (typeof SYSTEM_LAYER_OVERRIDES)[number];

export interface PromptSettings {
  readonly scope: PromptScope;
  readonly agent_name: string;
  readonly switches: Readonly<Record<string, boolean>>;
  readonly locked_switches: readonly string[];
  readonly custom_text: string;
  readonly system_layer: SystemLayerOverride | null;
  readonly revision: number;
}

export interface PromptTarget {
  readonly scope: PromptScope;
  readonly agent_name?: string;
}

export interface AgentPrompt {
  readonly layers?: readonly PromptLayer[];
  readonly final: string;
}

export interface AgentDeclaration {
  readonly agent_name: string;
  readonly configuration_schema: Readonly<Record<string, unknown>>;
  readonly overridable_fields: readonly string[];
  readonly enablement: AgentEnablement | null;
  readonly prompt: AgentPrompt;
  readonly tools: readonly AgentTool[];
}

export interface Mission {
  readonly id: string;
  readonly project_id: string;
  readonly version: number;
}

export interface MissionPlanEntry {
  readonly filename: string;
  readonly id?: string;
  readonly kind: NodeKind;
  readonly name: string;
  readonly requirement: string;
  readonly criterion: string;
  readonly verifications: readonly string[];
  readonly bindings: readonly string[];
  readonly parent?: string;
  readonly depends_on?: readonly string[];
}

export interface MissionPlanFile {
  readonly filename: string;
  readonly content: string;
}

export interface MissionJsonExport {
  readonly mission_id: string;
  readonly mission_version: number;
  readonly entries: readonly MissionPlanEntry[];
}

export interface MissionMarkdownExport {
  readonly mission_id: string;
  readonly mission_version: number;
  readonly files: readonly MissionPlanFile[];
}

interface MissionImportBase {
  readonly mission_id: string;
  readonly mission_version: number;
  readonly reason: string;
}

export type MissionImportSnapshot =
  | (MissionImportBase & { readonly format: "json"; readonly entries: readonly MissionPlanEntry[] })
  | (MissionImportBase & {
      readonly format: "markdown";
      readonly files: readonly MissionPlanFile[];
    });

export type MissionImportApply = MissionImportSnapshot & {
  readonly preview_digest: string;
  readonly confirmed_retirements: readonly string[];
};

export type MissionRemovedEdge =
  | { readonly kind: "containment"; readonly parent_id: string; readonly child_id: string }
  | { readonly kind: "dependency"; readonly dependent_id: string; readonly depends_on_id: string };

export interface MissionImportViolation {
  readonly code: string;
  readonly message: string;
  readonly filename: string | null;
  readonly node_id: string | null;
  readonly details: unknown;
}

export interface MissionImportPreview {
  readonly mission_id: string;
  readonly expected_mission_version: number;
  readonly preview_digest: string;
  readonly creates: readonly string[];
  readonly updates: readonly string[];
  readonly retirements: readonly string[];
  readonly removed_edges: readonly MissionRemovedEdge[];
  readonly no_ops: readonly string[];
  readonly violations: readonly MissionImportViolation[];
}

export interface MissionImportResult {
  readonly mission_id: string;
  readonly mission_version: number;
  readonly assigned_ids: readonly { readonly filename: string; readonly node_id: string }[];
}

export type BindingSetKind = "repository" | "worker" | "storage";

export type RepositoryActionName = "pull_request" | "merge_push";

export type RepositoryActionFollows =
  | { readonly type: "assessment_passed" }
  | { readonly type: "action_end_state"; readonly binding: string };

export type RepositoryPlatform = "github" | "gitlab" | "bitbucket";

export const WORKING_LAYER_KEYS = [
  "agents_md",
  "agents_local_md",
  "claude_md",
  "claude_local_md",
  "project_prompt",
] as const;

export type WorkingLayerKey = (typeof WORKING_LAYER_KEYS)[number];

export type WorkingLayerSwitches = Readonly<Record<WorkingLayerKey, boolean>>;

export interface RepositoryBindingConfig {
  readonly available: boolean;
  readonly platform: RepositoryPlatform;
  readonly address: string;
  readonly strategy: {
    readonly base_branch: string;
    readonly action?: {
      readonly name: RepositoryActionName;
      readonly follows: RepositoryActionFollows;
    };
  };
  readonly ssh_credential: string;
  readonly credential?: string;
  readonly project_prompt?: string;
  readonly working_layer?: WorkingLayerSwitches;
}

export type InstructionFileSource =
  "agents_md" | "agents_local_md" | "claude_md" | "claude_local_md";

export type InstructionFileState = "present" | "absent" | "invalid";

export interface InstructionFile {
  readonly source: InstructionFileSource;
  readonly path: string;
  readonly state: InstructionFileState;
  readonly reason: string | null;
  readonly text: string | null;
}

export interface InstructionFiles {
  readonly commit: string;
  readonly read_at: number;
  readonly files: readonly InstructionFile[];
}

export interface WorkerAgentEntry {
  readonly agent: string;
  readonly agent_provider?: string;
  readonly model_identifier?: string;
  readonly reasoning_effort?: string;
}

export interface WorkerBindingConfig {
  readonly worker: string;
  readonly instance_count: number;
  readonly resource_budget?: { readonly turns: number; readonly wall_time_ms: number };
  readonly entries?: readonly WorkerAgentEntry[];
}

export interface StorageBindingConfig {
  readonly available: boolean;
  readonly endpoint: string;
  readonly bucket: string;
  readonly region: string;
  readonly prefix: string;
  readonly credential: string;
}

export type BindingSetEntry =
  | { readonly kind: "repository"; readonly config: RepositoryBindingConfig }
  | { readonly kind: "worker"; readonly config: WorkerBindingConfig }
  | { readonly kind: "storage"; readonly config: StorageBindingConfig };

export interface BindingSet {
  readonly version: number;
  readonly bindings: Readonly<Record<string, BindingSetEntry>>;
}

export interface BindingSetWriteResult {
  readonly project_id: string;
  readonly binding_set_version: number;
  readonly changes: readonly {
    readonly kind: "created" | "revised" | "removed" | "unchanged";
    readonly binding_id: string;
  }[];
}

export type MissionActor =
  | { readonly kind: "human"; readonly account: string; readonly name: string }
  | {
      readonly kind: "execution";
      readonly execution_id: string;
      readonly client_id: string | null;
      readonly name: string | null;
    }
  | {
      readonly kind: "service";
      readonly service: "scheduler" | "mission";
      readonly inbound_event_id?: string;
    };

export interface MissionContent {
  readonly name: string;
  readonly requirement: string;
  readonly criterion: string;
  readonly verifications: readonly string[];
  readonly bindings: readonly string[];
}

export type MissionAssessmentResult = "success" | "criterion-not-met" | "undetermined";

export type MissionClosingEvent =
  | "success-override"
  | "human-discard"
  | "human-block"
  | "assessment-not-passed"
  | "external-failed"
  | "assessment-passed"
  | "external-success";

export interface MissionRepositoryAddress {
  readonly kind: "repository";
  readonly binding_id: string;
  readonly commit: string;
}

export interface MissionProducedAddress {
  readonly kind: "produced";
  readonly sha256: string;
}

export interface MissionObjectAddress {
  readonly kind: "object";
  readonly location: string;
  readonly version?: string;
  readonly sha256?: string;
}

export type MissionPlatformAddress =
  | { readonly kind: "pull_request"; readonly resource_identity: string; readonly number: number }
  | {
      readonly kind: "branch_push";
      readonly resource_identity: string;
      readonly branch: string;
      readonly commit: string;
    };

export type MissionAddress =
  MissionRepositoryAddress | MissionProducedAddress | MissionObjectAddress;

export type MissionTestedInput = MissionAddress | readonly MissionRepositoryAddress[];

export interface MissionVerification {
  readonly tested_input: MissionTestedInput;
  readonly results: readonly {
    readonly command: string;
    readonly exit_code: number | null;
    readonly signal: string | null;
    readonly timed_out: boolean;
  }[];
}

interface MissionAssetBase {
  readonly id: string;
  readonly published_at: number | null;
  readonly expired_at: number | null;
}

export type MissionEvidenceAsset =
  | (MissionAssetBase & { readonly kind: "repository"; readonly address: MissionRepositoryAddress })
  | (MissionAssetBase & { readonly kind: "produced"; readonly address: MissionProducedAddress })
  | (MissionAssetBase & {
      readonly kind: "object";
      readonly address: MissionObjectAddress;
      readonly storage_binding_id: string;
      readonly size: number;
      readonly media_type: string;
    })
  | (MissionAssetBase & { readonly kind: "platform"; readonly address: MissionPlatformAddress });

export interface MissionEvidence {
  readonly id: string;
  readonly node_id: string;
  readonly attempt: number;
  readonly subject: string;
  readonly assets: readonly MissionEvidenceAsset[];
  readonly provenance: MissionActor;
  readonly created_at: number;
  readonly requirement_key?: string;
  readonly end_state?: "expected" | "other";
  readonly verification?: MissionVerification;
}

export interface MissionCurrency {
  readonly current: boolean;
  readonly context_matches: boolean;
  readonly authority_admits: boolean;
  readonly order_selected: boolean;
  readonly reasons: readonly string[];
}

export interface MissionAssessment {
  readonly id: string;
  readonly node_id: string;
  readonly execution_id: string | null;
  readonly attempt: number;
  readonly node_revision: number;
  readonly evidence_ids: readonly string[];
  readonly child_outcome_ids: readonly string[];
  readonly result: MissionAssessmentResult;
  readonly rationale: string;
  readonly tested_input: MissionTestedInput | null;
  readonly actor: MissionActor;
  readonly created_at: number;
  readonly currency: MissionCurrency | null;
  readonly child_node_ids: readonly string[];
  readonly worker_version: string | null;
}

export interface MissionOutcome {
  readonly id: string;
  readonly node_id: string;
  readonly attempt: number;
  readonly node_revision: number;
  readonly closing_event: MissionClosingEvent;
  readonly result: MissionAssessmentResult;
  readonly assessment_id: string;
  readonly evidence_ids: readonly string[];
  readonly created_at: number;
}

export interface FrozenAction {
  readonly key: string;
  readonly binding_id: string;
  readonly action: RepositoryActionName;
  readonly expected_end_state: "pull_request_merged" | "base_branch_pushed";
  readonly follows: string | null;
  readonly configuration: { readonly base_branch: string };
}

export interface MissionAttempt {
  readonly node_id: string;
  readonly attempt: number;
  readonly node_revision: number;
  readonly required_external_actions: readonly FrozenAction[];
  readonly opened_at: number;
  readonly closed_at: number | null;
  readonly outcome_ids: readonly string[];
  readonly opened_by: MissionActor;
}

export interface MissionExternalAction {
  readonly node_id: string;
  readonly attempt: number;
  readonly action: FrozenAction;
  readonly requested: boolean;
  readonly request_evidence_id: string | null;
  readonly resolution: "unrequested" | "unresolved" | "expected-end" | "other-end";
}

export interface MissionBlockedContext {
  readonly outcome: MissionOutcome;
  readonly requests: readonly MissionEvidence[];
}

interface MissionNodeBase {
  readonly id: string;
  readonly filename: string;
  readonly mission_id: string;
  readonly parent_id: string | null;
  readonly visible_revision: number;
  readonly content: MissionContent;
  readonly retired_at: number | null;
  readonly pinned_by_attempts: readonly number[];
}

export interface MissionRunnableNode extends MissionNodeBase {
  readonly kind: "initiative" | "objective";
  readonly state: NodeState;
  readonly attempt: number;
  readonly priority: number;
  readonly depends_on: readonly string[];
  readonly blocked_context?: MissionBlockedContext;
}

export interface MissionTaskNode extends MissionNodeBase {
  readonly kind: "task";
}

export type MissionNodeRecord = MissionRunnableNode | MissionTaskNode;

export type MissionEdge =
  | { readonly kind: "containment"; readonly parent_id: string; readonly child_id: string }
  | { readonly kind: "dependency"; readonly dependent_id: string; readonly depends_on_id: string };

export type MissionRevisionWrite =
  | "import"
  | "node.create"
  | "node.update"
  | "node.move"
  | "node.retire"
  | "node.rebind"
  | "criterion.set"
  | "unblock";

export interface MissionTaskContent {
  readonly id: string;
  readonly filename: string;
  readonly content: MissionContent;
}

export interface MissionRevision {
  readonly node_id: string;
  readonly filename: string;
  readonly revision: number;
  readonly reason: string;
  readonly actor: MissionActor;
  readonly created_at: number;
  readonly content: MissionContent;
  readonly tasks?: readonly MissionTaskContent[];
  readonly change: {
    readonly write: MissionRevisionWrite;
    readonly previous_revision: number | null;
    readonly changed_fields: readonly string[];
    readonly tasks?: readonly {
      readonly id: string;
      readonly change: "created" | "updated" | "moved-in" | "moved-out" | "retired";
      readonly changed_fields: readonly string[];
    }[];
  };
  readonly pinned_by_attempts: readonly number[];
}

export interface ProjectBindingRecord {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly kind: BindingSetKind;
  readonly resource_identity: string;
  readonly revision: number;
  readonly config: unknown;
  readonly created_at: number;
  readonly removed_at: number | null;
}

export type ClaimState = "running" | "lost" | "finished";

export interface SchedulerJob {
  readonly job_id: string;
  readonly project_id: string;
  readonly node_id: string;
  readonly priority: number;
}

export interface SchedulerExecutionRecord {
  readonly execution_id: string;
  readonly project_id: string;
  readonly node_id: string;
  readonly claimant: {
    readonly worker_binding_id: string;
    readonly resource_identity: string;
    readonly runtime_identity: string;
    readonly client_id?: string;
    readonly name?: string;
  };
  readonly attempt: number;
  readonly pinned_revision: number;
  readonly credentials: readonly string[];
  readonly claim_state: ClaimState;
  readonly expired_at: number;
  readonly created_at: number;
  readonly ended_at: number | null;
  readonly trace_id: string;
  readonly root_span_id: string;
}

export type CredentialComponent = "llm" | "repository" | "storage";

export type CredentialPlatform = string;

export type SecretShape = "api_key" | "oauth" | "s3_access_key" | "none";

export interface CredentialPlatformEntry {
  readonly platform: CredentialPlatform;
  readonly secret_shape: SecretShape;
  readonly login_modes: readonly CredentialLoginMode[];
  readonly metadata_fields: readonly string[];
  readonly verifiable: boolean;
}

export interface CredentialPlatformList {
  readonly items: readonly CredentialPlatformEntry[];
}

export interface CredentialRevision {
  readonly id: string;
  readonly revision: number;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly created_at: number;
  readonly ended_at: number | null;
}

export interface Credential {
  readonly name: string;
  readonly platform: CredentialPlatform;
  readonly revisions: readonly CredentialRevision[];
}

export interface CredentialAgentProvider {
  readonly agent: string;
  readonly name: string;
}

export interface LlmCredential extends Credential {
  readonly agent_providers: readonly CredentialAgentProvider[];
}

export interface CredentialBinding {
  readonly project_id: string;
  readonly project_name: string;
  readonly binding_id: string;
  readonly name: string;
}

export interface RepositoryCredential extends Credential {
  readonly bindings: readonly CredentialBinding[];
}

export interface StorageCredential extends Credential {
  readonly bindings: readonly CredentialBinding[];
}

export interface ComponentCredential {
  readonly llm: LlmCredential;
  readonly repository: RepositoryCredential;
  readonly storage: StorageCredential;
}

export interface CredentialModel {
  readonly id: string;
  readonly context_window?: number;
  readonly max_tokens?: number;
  readonly reasoning_levels?: readonly ReasoningEffort[];
}

export interface OpenAiCompatibleMetadata {
  readonly base_url: string;
  readonly models: readonly CredentialModel[];
}

export interface SshMetadata {
  readonly host: string;
  readonly hostname: string;
  readonly port: number;
  readonly identity_file: string;
}

export type CredentialMetadata =
  OpenAiCompatibleMetadata | SshMetadata | Readonly<Record<string, string>> | null;

export interface ApiKeySecret {
  readonly key: string;
}

export interface OAuthSecret {
  readonly refresh: string;
  readonly access: string;
  readonly expires: number;
}

export interface S3AccessKeySecret {
  readonly access_key_id: string;
  readonly secret_access_key: string;
}

export type CredentialSecret = ApiKeySecret | OAuthSecret | S3AccessKeySecret;

export interface CredentialCreateBody {
  readonly name: string;
  readonly platform: CredentialPlatform;
  readonly metadata: CredentialMetadata;
  readonly secret: ApiKeySecret | S3AccessKeySecret | Record<string, never>;
}

export type CredentialCheckBody = Omit<CredentialCreateBody, "name">;

export interface CredentialRotateBody {
  readonly expected_revision: number;
  readonly secret: CredentialSecret;
  readonly metadata?: CredentialMetadata;
}

export interface CredentialMetadataBody {
  readonly expected_revision: number;
  readonly metadata: CredentialMetadata;
}

export type CredentialLoginMode = "browser" | "device";

export interface CredentialLoginBody {
  readonly platform: CredentialPlatform;
  readonly name: string;
  readonly mode?: CredentialLoginMode;
}

export interface CredentialLoginSession {
  readonly session_id: string;
  readonly address: string;
  readonly code: string | null;
  readonly expires_at: number;
}

export type CredentialLoginState = "pending" | "completed" | "failed" | "expired";

export interface CredentialLoginStatus {
  readonly session_id: string;
  readonly state: CredentialLoginState;
  readonly last_message: string | null;
  readonly failure_reason: string | null;
}

export type ResourceStatus = "healthy" | "unhealthy" | "unknown";

export interface HealthEntry {
  readonly status: ResourceStatus;
  readonly capability: string;
}

export interface BindingVerifyResult {
  readonly address: HealthEntry;
  readonly ssh_credential: HealthEntry;
  readonly credential: HealthEntry | null;
}

interface SshAliasItemBase {
  readonly host: string;
  readonly hostname: string;
  readonly port: number;
}

export type SshAliasItem =
  | (SshAliasItemBase & { readonly state: "ready"; readonly identity_file: string })
  | (SshAliasItemBase & {
      readonly state: "refused";
      readonly identity_file: string | null;
      readonly reason: string | null;
    })
  | (SshAliasItemBase & { readonly state: "present"; readonly identity_file: string | null });

export interface SshDiscoverResult {
  readonly items: readonly SshAliasItem[];
}

export interface WorkbenchConfiguration {
  readonly agent_provider: string;
  readonly model_identifier: string;
  readonly reasoning_effort: ReasoningEffort;
}

export interface WorkbenchSessionCreateBody extends WorkbenchConfiguration {
  readonly agent_name: string;
}

export interface WorkbenchSessionListItem {
  readonly id: string;
  readonly agent_name: string;
  readonly name: string | null;
  readonly created: number;
  readonly modified: number;
  readonly message_count: number;
  readonly first_message: string;
}

export interface WorkbenchSessionEntry {
  readonly type: string;
  readonly id: string;
  readonly parentId: string | null;
  readonly timestamp: string;
  readonly [field: string]: unknown;
}

export interface WorkbenchSession {
  readonly id: string;
  readonly agent_name: string;
  readonly configuration: WorkbenchConfiguration;
  readonly entries: readonly WorkbenchSessionEntry[];
  readonly run_active: boolean;
  readonly resume_command: string;
}

export interface WorkbenchPendingApproval {
  readonly tool_call_id: string;
  readonly operation_id: string;
  readonly input: Readonly<Record<string, unknown>>;
}

export interface WorkbenchRunSnapshot {
  readonly streaming_message: Readonly<Record<string, unknown>> | null;
  readonly pending_tool_calls: readonly string[];
  readonly pending_approval: WorkbenchPendingApproval | null;
  readonly run_active: boolean;
  readonly error_message: string | null;
}

export interface WorkbenchSessionEvents {
  readonly entries: readonly WorkbenchSessionEntry[];
  readonly snapshot: WorkbenchRunSnapshot;
  readonly version: number;
}

export interface WorkbenchMessageAnswer {
  readonly session_id: string;
  readonly run_active: true;
}

export interface WorkbenchAbortAnswer {
  readonly session_id: string;
  readonly run_active: false;
}

export interface WorkbenchApprovalAnswer {
  readonly session_id: string;
  readonly tool_call_id: string;
  readonly approved: boolean;
}
