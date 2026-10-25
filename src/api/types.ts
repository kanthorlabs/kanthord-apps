/**
 * The daemon contract.
 *
 * Derived from the kanthord design set: overview.md, architecture.md,
 * project-service.md, mission-service.md, scheduler-service.md and
 * worker-service.md, together with their vocabulary siblings.
 */

export type Intent = "implement" | "examine";

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
  readonly paused_at: number | null;
  readonly workspace_directory: string;
}

/** Why a node is not running. The Scheduler rechecks each of these at the claim. */
export type WorkerHost = "kanthord" | "external-harness";

export type RegistrationActivity = "idle" | "pulling" | "executing";

export interface WorkerCatalogItem {
  readonly name: string;
  readonly host: WorkerHost;
  readonly declared_node_states: readonly string[];
  readonly declared_intents: readonly Intent[];
}

export interface WorkerResourceBudget {
  readonly wall_time_ms: number;
  readonly turns?: number;
}

export type WorkerMethod = "steps" | "evaluation";

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

interface WorkerRegistrationBase {
  readonly runtime_identity: string;
  readonly project_id: string;
  readonly resource_identity: string;
  readonly worker_name: string;
  readonly client_id?: string;
  readonly name?: string;
  readonly instance?: string | null;
  readonly activity: RegistrationActivity;
  readonly draining: boolean;
  readonly execution_id?: string;
  readonly registered: boolean;
}

export type WorkerRegistrationRecord =
  | (WorkerRegistrationBase & { readonly host: "kanthord"; readonly placement: WorkerPlacement })
  | (WorkerRegistrationBase & { readonly host: "external-harness" });

export interface InstanceConnection {
  readonly connection_name: string;
  readonly connected_at: number;
  readonly last_heartbeat_at: number;
}

export interface WorkerInstance {
  readonly id: string;
  readonly name: string;
  readonly worker: string;
  readonly revision: number;
  readonly public_key: string;
  readonly fingerprint: string;
  readonly created_at: number;
  readonly ended_at: number | null;
}

export interface WorkerInstanceListItem extends WorkerInstance {
  readonly connection: InstanceConnection | null;
  readonly binding_count: number;
  readonly holder_mismatch: boolean;
}

export interface InstanceBinding {
  readonly project_id: string;
  readonly binding: string;
}

export interface ReportedModel {
  readonly id: string;
  readonly owned_by: string | null;
  readonly created: number | null;
}

export interface CopyHealth extends HealthEntry {
  readonly models: readonly ReportedModel[] | null;
  readonly reported_at: number | null;
}

export interface InstanceCredentialCopy {
  readonly name: string;
  readonly revision: number;
  readonly platform: CredentialPlatform;
  readonly sealed_current: boolean;
  readonly health: CopyHealth;
}

export interface WorkerInstanceDetail extends WorkerInstance {
  readonly connection: InstanceConnection | null;
  readonly bindings: readonly InstanceBinding[];
  readonly registrations: readonly WorkerRegistrationRecord[];
  readonly credentials: readonly InstanceCredentialCopy[];
}

export interface WorkerInstanceWriteAnswer extends WorkerInstance {
  readonly instance_configuration?: string;
}

export interface WorkerInstanceCreateBody {
  readonly name: string;
  readonly worker: string;
  readonly endpoint: string;
}

export type AgentEnablementState = "enabled" | "disabled";

export const AGENT_PROVIDER_KINDS = [
  "github-copilot",
  "openai-codex",
  "anthropic-subscription",
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
  readonly fallback_configurations: readonly AgentDefaultConfiguration[];
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
  readonly fallback_configurations: readonly AgentDefaultConfiguration[];
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

export type PromptPartKind = "standard" | "role" | "workbench" | "binding";

export interface PromptPart {
  readonly part: PromptPartKind;
  readonly name: string;
  readonly origin: PromptOrigin;
  readonly path: string | null;
  readonly digest: string;
  readonly text: string;
}

export interface AgentPrompt {
  readonly parts?: readonly PromptPart[];
  readonly final: string;
}

export interface AgentDeclaration {
  readonly agent_name: string;
  readonly configuration_schema: Readonly<Record<string, unknown>>;
  readonly overridable_fields: readonly string[];
  readonly enablement: AgentEnablement | null;
  readonly prompt: AgentPrompt;
  readonly tools: readonly AgentTool[];
  readonly chain: readonly AgentChainEntry[];
  readonly active_position: number | null;
  readonly cooling: AgentCooling | null;
}

export type AgentChainEntry = Omit<AgentSelection, "agent_name"> & {
  readonly cooldown: { readonly strikes: number; readonly available_at: number } | null;
};

export interface Mission {
  readonly id: string;
  readonly project_id: string;
  readonly version: number;
}

export interface MissionPlanNodeEntry {
  readonly filename: string;
  readonly id?: string;
  readonly intent: Intent;
  readonly name: string;
  readonly requirement: string;
  readonly criterion: string;
  readonly verifications: readonly string[];
  readonly bindings: readonly string[];
  readonly tags?: readonly string[];
  readonly depends_on?: readonly string[];
}

export interface MissionPlanTaskEntry {
  readonly filename: string;
  readonly id?: string;
  readonly node: string;
  readonly name: string;
  readonly requirement: string;
  readonly criterion: string;
  readonly verifications: readonly string[];
  readonly bindings: readonly string[];
}

export type MissionPlanEntry = MissionPlanNodeEntry | MissionPlanTaskEntry;

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

export interface MissionRemovedEdge {
  readonly dependent_id: string;
  readonly depends_on_id: string;
}

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

export const BINDING_PROMPT_AGENTS = ["swe@1", "re@1", "env@1"] as const;

export type BindingPromptAgent = (typeof BINDING_PROMPT_AGENTS)[number];

export type BindingPrompts = Readonly<Partial<Record<BindingPromptAgent, string>>>;

export type EnvironmentDocument = Readonly<Record<string, unknown>>;

export type EnvironmentStatus = "none" | "pending" | "building" | "proving" | "ready" | "failed";

export type EnvironmentTarget = "image" | "host" | "remote";

export type EnvironmentSource = "stored" | "repository" | "detected" | "universal" | "none";

export type EnvironmentFailureClass =
  "build_failed" | "image_invalid" | "setup_failed" | "command_absent";

export type EnvironmentFailureOrigin = "onboarding" | "execution";

export interface EnvironmentCheck {
  readonly command: string;
  readonly exit_code: number;
}

export interface EnvironmentFailure {
  readonly class: EnvironmentFailureClass;
  readonly origin: EnvironmentFailureOrigin;
  readonly execution_id: string | null;
  readonly command: string;
  readonly exit_code: number | null;
  readonly tail: string;
  readonly reproduce: string;
  readonly ended_at: number;
}

export interface EnvironmentState {
  readonly binding_id: string;
  readonly binding_name: string;
  readonly resource_identity: string;
  readonly target: EnvironmentTarget;
  readonly source: EnvironmentSource;
  readonly status: EnvironmentStatus;
  readonly digest: string | null;
  readonly tag: string | null;
  readonly run_started_at: number | null;
  readonly step_started_at: number | null;
  readonly reason: string | null;
  readonly reason_started_at: number | null;
  readonly failure: EnvironmentFailure | null;
  readonly checks: readonly EnvironmentCheck[];
  readonly repairs: number;
  readonly repairing: boolean;
}

export interface EnvironmentList {
  readonly items: readonly EnvironmentState[];
}

export interface BindingEnvironment {
  readonly source: EnvironmentSource;
  readonly commit: string | null;
  readonly environment: EnvironmentDocument | null;
  readonly reason: string | null;
}

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
  readonly prompts?: BindingPrompts;
  readonly environment?: EnvironmentDocument;
  readonly environment_secrets?: Readonly<Record<string, string>>;
}

export interface WorkerAgentEntry {
  readonly agent: string;
  readonly agent_provider?: string;
  readonly model_identifier?: string;
  readonly reasoning_effort?: string;
  readonly fallback_configurations?: readonly AgentDefaultConfiguration[];
}

export type WorkerPlacement = "server" | "container" | "worker";

export type PlacementReason =
  "server_in_container" | "runtime_absent" | "runtime_failed" | "runtime_rootful";

export interface PlacementStatus {
  readonly placement: WorkerPlacement;
  readonly available: boolean;
  readonly reason: PlacementReason | null;
  readonly detail: string | null;
  readonly container_runtime: "podman" | "docker" | null;
}

export interface WorkerBindingConfig {
  readonly worker: string;
  readonly instance_count?: number;
  readonly worker_instances?: readonly string[];
  readonly placement?: WorkerPlacement;
  readonly resource_budget?: { readonly turns: number; readonly wall_time_ms: number };
  readonly entries?: readonly WorkerAgentEntry[];
  readonly tags?: readonly string[];
  readonly environment?: string;
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

export interface StalePin {
  readonly node_id: string;
  readonly binding_name: string;
  readonly pinned_revision: number;
  readonly current_revision: number;
}

export interface BindingSetWriteResult {
  readonly project_id: string;
  readonly binding_set_version: number;
  readonly changes: readonly {
    readonly kind: "created" | "revised" | "removed" | "unchanged";
    readonly binding_id: string;
  }[];
  readonly stale_pins: readonly StalePin[];
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
  readonly intent: Intent;
  readonly tags: readonly string[];
}

export interface MissionTaskBody {
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
  readonly dependency_outcome_ids: readonly string[];
  readonly result: MissionAssessmentResult;
  readonly rationale: string;
  readonly tested_input: MissionTestedInput | null;
  readonly actor: MissionActor;
  readonly created_at: number;
  readonly currency: MissionCurrency | null;
  readonly dependency_node_ids: readonly string[];
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

export type ActionLanding = "human" | "kanthord";

export interface FrozenAction {
  readonly key: string;
  readonly binding_id: string;
  readonly action: RepositoryActionName;
  readonly expected_end_state: "pull_request_merged" | "base_branch_pushed";
  readonly follows: string | null;
  readonly configuration: { readonly base_branch: string; readonly landing: ActionLanding };
}

export type StartPoint = "base_branch" | "node_branch";

export interface MissionAttempt {
  readonly node_id: string;
  readonly attempt: number;
  readonly node_revision: number;
  readonly start_point: StartPoint;
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

export interface MissionNodeRecord {
  readonly id: string;
  readonly filename: string;
  readonly mission_id: string;
  readonly intent: Intent;
  readonly tags: readonly string[];
  readonly tasks: readonly MissionTaskContent[];
  readonly state: NodeState;
  readonly attempt: number;
  readonly pinned_revision: number | null;
  readonly priority: number;
  readonly depends_on: readonly string[];
  readonly visible_revision: number;
  readonly content: MissionContent;
  readonly retired_at: number | null;
  readonly pinned_by_attempts: readonly number[];
  readonly blocked_context?: MissionBlockedContext;
}

export interface MissionEdge {
  readonly dependent_id: string;
  readonly depends_on_id: string;
}

export type MissionRevisionWrite =
  "import" | "node.create" | "node.update" | "node.rebind" | "criterion.set" | "unblock";

export interface MissionTaskContent {
  readonly id: string;
  readonly filename: string;
  readonly content: MissionTaskBody;
}

export interface MissionRevision {
  readonly node_id: string;
  readonly filename: string;
  readonly revision: number;
  readonly reason: string;
  readonly actor: MissionActor;
  readonly created_at: number;
  readonly content: MissionContent;
  readonly tasks: readonly MissionTaskContent[];
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

export interface MissionProposalTask {
  readonly name: string;
  readonly requirement: string;
  readonly criterion: string;
  readonly verifications: readonly string[];
}

export interface MissionProposalContent {
  readonly dependency_id: string;
  readonly name: string;
  readonly requirement: string;
  readonly criterion: string;
  readonly task: MissionProposalTask;
}

export interface MissionProposal {
  readonly id: string;
  readonly node_id: string;
  readonly attempt: number;
  readonly assessment_id: string;
  readonly content: MissionProposalContent;
  readonly created_node_id: string | null;
  readonly approved_at: number | null;
  readonly created_at: number;
}

export interface MissionProposalApproveBody {
  readonly expected_mission_version: number;
  readonly reason?: string;
}

export interface MissionNodeChange {
  readonly mission_version: number;
  readonly revisions: readonly MissionRevision[];
  readonly retired_node_ids: readonly string[];
  readonly added_edges: readonly MissionEdge[];
  readonly removed_edges: readonly MissionEdge[];
  readonly open_attempts_unchanged: readonly {
    readonly node_id: string;
    readonly attempt: number;
  }[];
}

export interface MissionControlResult {
  readonly node: MissionNodeRecord;
  readonly attempt: MissionAttempt | null;
  readonly outcome: MissionOutcome | null;
  readonly actor: MissionActor;
  readonly accepted_at: number;
}

export interface MissionNodeUnblockBody {
  readonly blocked_attempt: number;
  readonly expected_revision: number;
  readonly expected_mission_version: number;
  readonly reason?: string;
  readonly start_point?: StartPoint;
}

export interface MissionHumanActBody {
  readonly reason: string;
  readonly expected_mission_version: number;
  readonly expected_state: NodeState;
  readonly expected_attempt: number;
}

export interface MissionNodeResumeBody extends MissionHumanActBody {
  readonly target: "Available" | "Waiting";
}

export interface MissionNodeOverrideBody extends MissionHumanActBody {
  readonly result: "success";
}

export interface MissionDependencyBody {
  readonly reason: string;
  readonly expected_mission_version: number;
}

export interface MissionNodeCheckBody {
  readonly expected_mission_version: number;
}

export type MissionCheckResolution = "unresolved" | "expected-end" | "other-end";

export interface MissionNodeCheckResult {
  readonly evidence_id: string;
  readonly requirement_key: string;
  readonly resolution: MissionCheckResolution;
}

export interface MissionNodeCheckFailure {
  readonly evidence_id: string;
  readonly error: {
    readonly error: {
      readonly code: string;
      readonly message: string;
      readonly details: unknown;
    };
    readonly request_id: string;
  };
}

export interface MissionNodeCheckAnswer {
  readonly results: readonly MissionNodeCheckResult[];
  readonly failures: readonly MissionNodeCheckFailure[];
}

export interface MissionProposalApproveResult {
  readonly created: MissionNodeChange;
  readonly proposer: MissionControlResult;
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

export interface WorkerBindingRecord extends ProjectBindingRecord {
  readonly kind: "worker";
  readonly config: WorkerBindingConfig;
}

export interface AgentCooldown {
  readonly credential: string;
  readonly strikes: number;
  readonly available_at: number;
}

export interface AgentCooling {
  readonly code: string;
  readonly available_at: number;
}

export interface BindingAgentIssue {
  readonly path: readonly string[];
  readonly code: string;
}

export interface BindingAgentView {
  readonly agent: string;
  readonly worker: string;
  readonly worker_binding_id: string;
  readonly binding_set_version: number;
  readonly defaults: Readonly<Record<string, unknown>> | null;
  readonly entry: Readonly<Record<string, unknown>> | null;
  readonly effective: Readonly<Record<string, unknown>> | null;
  readonly chain: readonly unknown[];
  readonly active_position: number | null;
  readonly cooling: AgentCooling | null;
  readonly valid: boolean;
  readonly issues: readonly BindingAgentIssue[];
}

export type ClaimState = "running" | "lost" | "finished";

export interface SchedulerJob {
  readonly job_id: string;
  readonly project_id: string;
  readonly node_id: string;
  readonly priority: number;
  readonly queued_at: number;
}

export type ExecutionStopReason =
  | "operation_failed"
  | "judgement_invalid"
  | "report_absent"
  | "action_unsettled"
  | "assessment_absent"
  | "budget_end"
  | "provider_failed"
  | "no_progress";

export interface ExecutionStop {
  readonly reason: ExecutionStopReason;
  readonly code: string | null;
  readonly detail?: string;
}

export interface AgentSelection {
  readonly agent_name: string;
  readonly position: number;
  readonly level: "enablement" | "binding";
  readonly agent_provider: string;
  readonly provider: string;
  readonly credential: string;
  readonly model_identifier: string;
  readonly reasoning_effort: string;
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
  readonly node_branch: string;
  readonly credentials: readonly string[];
  readonly agent_selections: readonly AgentSelection[];
  readonly claim_state: ClaimState;
  readonly expired_at: number;
  readonly created_at: number;
  readonly ended_at: number | null;
  readonly stop: ExecutionStop | null;
  readonly trace_id: string;
  readonly root_span_id: string;
}

export type CredentialComponent = "llm" | "repository" | "storage";

export type CredentialPlatform = string;

export type SecretShape = "api_key" | "oauth" | "s3_access_key" | "ssh_key";

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
  readonly holder: string;
  readonly sealed_to: string | null;
  readonly sealed_current: boolean;
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
  readonly public_key: string;
  readonly fingerprint: string;
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
  readonly holders?: readonly string[];
}

export interface EnvironmentSecretCreateBody {
  readonly name: string;
  readonly platform: "environment_secret";
  readonly metadata: null;
  readonly secret: ApiKeySecret;
}

export interface EnvironmentSecretRotateBody {
  readonly expected_revision: number;
  readonly secret: ApiKeySecret;
}

export type CredentialCheckBody = Omit<CredentialCreateBody, "name" | "holders">;

export interface CredentialRotateBody {
  readonly expected_revision: number;
  readonly secret: CredentialSecret;
  readonly metadata?: CredentialMetadata;
}

export interface CredentialMetadataBody {
  readonly expected_revision: number;
  readonly metadata: CredentialMetadata;
}

export type CredentialLoginMode = "browser" | "device" | "copy_code";

export interface CredentialLoginBody {
  readonly platform: CredentialPlatform;
  readonly name: string;
  readonly mode?: CredentialLoginMode;
  readonly holder?: string;
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

export type ResourceFailureReason =
  | "host_key_unknown"
  | "key_refused"
  | "repository_not_found"
  | "host_unreachable"
  | "address_invalid"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "unreachable"
  | "invalid_response"
  | "host_key_changed"
  | "identity_unavailable"
  | "held_by_instance"
  | "deadline_exceeded"
  | "unclassified";

export interface HealthEntry {
  readonly status: ResourceStatus;
  readonly capability: string;
  readonly failure_reason: ResourceFailureReason | null;
}

export interface BindingVerifyResult {
  readonly address: HealthEntry;
  readonly ssh_credential: HealthEntry;
  readonly credential: HealthEntry | null;
}

export interface SshKeyCreateBody {
  readonly name: string;
}

export interface SshKeyRotateBody {
  readonly expected_revision: number;
}

export type HostKeySource = "github_meta" | "keyscan";

export interface HostKeyScan {
  readonly host: string;
  readonly public_key: string;
  readonly fingerprint: string;
  readonly source: HostKeySource;
}

export interface HostKey extends HostKeyScan {
  readonly created_at: number;
}

export interface HostKeyPinBody {
  readonly fingerprint: string;
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
  readonly run_active: boolean;
  readonly pending_approval: WorkbenchPendingApprovalSummary | null;
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

export interface WorkbenchPendingApprovalSummary {
  readonly tool_call_id: string;
  readonly operation_id: string;
}

export interface WorkbenchPendingApproval extends WorkbenchPendingApprovalSummary {
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

export type TraceState = "open" | "ok" | "error";

export type TraceSort = "started_at" | "duration_ms" | "total_tokens" | "cost_usd";

export interface TraceSummary {
  readonly trace_id: string;
  readonly project_id: string | null;
  readonly execution_id: string | null;
  readonly node_id: string | null;
  readonly attempt: number | null;
  readonly root_span_id: string;
  readonly created_at: number;
  readonly state: TraceState;
  readonly started_at: number | null;
  readonly ended_at: number | null;
  readonly duration_ms: number | null;
  readonly stop_reason: string | null;
  readonly worker_name: string | null;
  readonly agent_names: readonly string[];
  readonly models: readonly string[];
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_tokens: number;
  readonly cache_creation_tokens: number;
  readonly total_tokens: number;
  readonly cost_usd: number;
  readonly span_count: number;
  readonly turn_count: number;
  readonly tool_count: number;
  readonly error_count: number;
  readonly error_types: readonly string[];
  readonly first_error_span_id: string | null;
  readonly root_operation: string | null;
  readonly root_attributes: Readonly<Record<string, SpanAttributeValue>> | null;
}

export interface TraceFacets {
  readonly worker_names: readonly string[];
  readonly agent_names: readonly string[];
  readonly models: readonly string[];
  readonly error_types: readonly string[];
}

export type SpanStatus = "Unset" | "Ok" | "Error";

export type SpanOrigin = "observed" | "asserted";

export type SpanAttributeValue =
  string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];

export interface TraceSpanEvent {
  readonly name: string;
  readonly time: number;
  readonly attributes?: Readonly<Record<string, SpanAttributeValue>>;
}

export interface TraceSpanLink {
  readonly trace_id: string;
  readonly span_id: string;
}

export interface TraceSpan {
  readonly trace_id: string;
  readonly span_id: string;
  readonly parent_span_id: string | null;
  readonly producer: string;
  readonly origin: SpanOrigin;
  readonly operation: string;
  readonly start_time: number | null;
  readonly end_time: number | null;
  readonly status: SpanStatus;
  readonly attributes: Readonly<Record<string, SpanAttributeValue>>;
  readonly events: readonly TraceSpanEvent[];
  readonly links: readonly TraceSpanLink[];
  readonly text_ids: readonly string[];
  readonly created_at: number;
}

export interface TelemetryText {
  readonly trace_id: string;
  readonly text_id: string;
  readonly content: string;
  readonly created_at: number;
}

export interface TraceSessionEntry {
  readonly trace_id: string;
  readonly session_id: string;
  readonly entry_id: string;
  readonly parent_entry_id: string | null;
  readonly sequence: number;
  readonly entry_type: string;
  readonly entry_time: number;
  readonly tool_call_id: string | null;
  readonly truncated: boolean;
  readonly entry: Readonly<Record<string, unknown>>;
  readonly created_at: number;
}

export interface TraceListQuery {
  readonly project_id?: string;
  readonly node_id?: string;
  readonly execution_id?: string;
  readonly worker_name?: string;
  readonly agent_name?: string;
  readonly model?: string;
  readonly state?: TraceState;
  readonly error_type?: string;
  readonly q?: string;
  readonly from?: number;
  readonly to?: number;
  readonly min_duration_ms?: number;
  readonly max_duration_ms?: number;
  readonly min_total_tokens?: number;
  readonly max_total_tokens?: number;
  readonly min_cost_usd?: number;
  readonly max_cost_usd?: number;
  readonly sort?: TraceSort;
}

export const ACT_OPERATIONS = [
  "mission.node.pause",
  "mission.node.resume",
  "mission.node.ready",
  "mission.node.block",
  "mission.node.unblock",
  "mission.node.discard",
  "mission.node.override",
  "mission.proposal.approve",
  "mission.evidence.delete",
] as const;

export type ActOperation = (typeof ACT_OPERATIONS)[number];

export const TRANSITION_RULES = [
  "none",
  "failure_limit",
  "further_work_limit",
  "rework_limit",
] as const;

export type TransitionRule = (typeof TRANSITION_RULES)[number];

export const REVOKE_CAUSES = ["assessment", "human"] as const;

export type RevokeCause = (typeof REVOKE_CAUSES)[number];

export type TimelineDepth = 1 | 2;

export interface TimelineItem extends TraceSpan {
  readonly depth: TimelineDepth;
  readonly duration_ms: number | null;
  readonly project_id: string;
  readonly node_id: string | null;
  readonly execution_id: string | null;
  readonly attempt: number | null;
  readonly worker_name: string | null;
}

export type TimelineScope =
  | {
      readonly execution_id: string;
      readonly node_id?: never;
      readonly project_id?: never;
    }
  | {
      readonly node_id: string;
      readonly execution_id?: never;
      readonly project_id?: never;
    }
  | {
      readonly project_id: string;
      readonly execution_id?: never;
      readonly node_id?: never;
    };

export type TimelineQuery = TimelineScope & {
  readonly depth?: TimelineDepth;
  readonly from?: number;
  readonly to?: number;
};

export const ANALYTICS_BUCKETS = ["none", "hour", "day", "week"] as const;

export type AnalyticsBucket = (typeof ANALYTICS_BUCKETS)[number];

export const ANALYTICS_COST_GROUPS = [
  "none",
  "model",
  "agent_name",
  "provider_name",
  "worker_name",
  "node_id",
  "project_id",
] as const;

export type AnalyticsCostGroup = (typeof ANALYTICS_COST_GROUPS)[number];

export const ANALYTICS_DURATION_GROUPS = [
  "none",
  "operation",
  "tool_name",
  "agent_name",
  "model",
  "worker_name",
  "node_id",
  "project_id",
] as const;

export type AnalyticsDurationGroup = (typeof ANALYTICS_DURATION_GROUPS)[number];

export const ANALYTICS_MEASURES = [
  "span_duration",
  "tool_latency",
  "verification_time",
  "queue_wait",
  "review_wait",
  "revision_turns",
] as const;

export type AnalyticsMeasure = (typeof ANALYTICS_MEASURES)[number];

export interface AnalyticsRange {
  readonly from?: number;
  readonly to?: number;
  readonly project_id?: string;
  readonly node_id?: string;
  readonly bucket?: AnalyticsBucket;
}

export interface AnalyticsCostQuery extends AnalyticsRange {
  readonly group_by?: AnalyticsCostGroup;
}

export interface AnalyticsDurationQuery extends AnalyticsRange {
  readonly measure: AnalyticsMeasure;
  readonly operation?: string;
  readonly group_by?: AnalyticsDurationGroup;
}

export interface AnalyticsCostItem {
  readonly key: string | null;
  readonly bucket_start: number | null;
  readonly turn_count: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_tokens: number;
  readonly cache_creation_tokens: number;
  readonly total_tokens: number;
  readonly cost_usd: number;
}

export interface AnalyticsDurationItem {
  readonly key: string | null;
  readonly bucket_start: number | null;
  readonly count: number;
  readonly p50: number;
  readonly p90: number;
  readonly p99: number;
  readonly mean: number;
  readonly max: number;
}

export interface AnalyticsPage<T> {
  readonly items: readonly T[];
  readonly truncated: boolean;
}
