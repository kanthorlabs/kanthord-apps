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
  readonly nextCursor: string | null;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly bindingSetVersion: number;
  readonly createdAt: number;
}

/** Why a node is not running. The Scheduler rechecks each of these at the claim. */
export type WorkerHost = "kanthord" | "external-harness";

export type InstanceActivity = "idle" | "pulling" | "executing";

export interface WorkerCatalogItem {
  readonly name: string;
  readonly host: WorkerHost;
  readonly declaredNodeStates: readonly string[];
  readonly requiredNodeFormat: readonly string[];
}

interface WorkerInstanceBase {
  readonly runtimeIdentity: string;
  readonly projectId: string;
  readonly resourceIdentity: string;
  readonly workerName: string;
  readonly clientId?: string;
  readonly name?: string;
  readonly activity: InstanceActivity;
  readonly draining: boolean;
  readonly executionId?: string;
  readonly registered: boolean;
}

export type WorkerInstanceRecord =
  | (WorkerInstanceBase & { readonly host: "kanthord"; readonly placement: "server" | "worker" })
  | (WorkerInstanceBase & { readonly host: "external-harness" });

export type AgentEnablementState = "enabled" | "disabled";

export type AgentProviderKind = "github-copilot" | "anthropic" | "openai-compatible";

export type ReasoningEffort = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface AgentProvider {
  readonly name: string;
  readonly provider: AgentProviderKind;
  readonly credential: string;
}

export interface AgentDefaultConfiguration {
  readonly agentProvider: string;
  readonly modelIdentifier: string;
  readonly reasoningEffort: ReasoningEffort;
}

export interface AgentEnablement {
  readonly agentName: string;
  readonly state: AgentEnablementState;
  readonly agentProviders: readonly AgentProvider[];
  readonly defaultConfiguration: AgentDefaultConfiguration;
  readonly revision: number;
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
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export interface AgentDeclaration {
  readonly agentName: string;
  readonly configurationSchema: Readonly<Record<string, unknown>>;
  readonly overridableFields: readonly string[];
  readonly enablement: AgentEnablement | null;
  readonly basePrompt?: string;
  readonly agentPrompt: string;
  readonly tools: readonly AgentTool[];
}

export interface Mission {
  readonly id: string;
  readonly projectId: string;
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
  readonly dependsOn?: readonly string[];
}

export interface MissionPlanFile {
  readonly filename: string;
  readonly content: string;
}

export interface MissionJsonExport {
  readonly missionId: string;
  readonly missionVersion: number;
  readonly entries: readonly MissionPlanEntry[];
}

interface MissionImportBase {
  readonly missionId: string;
  readonly missionVersion: number;
  readonly reason: string;
}

export type MissionImportSnapshot =
  | (MissionImportBase & { readonly format: "json"; readonly entries: readonly MissionPlanEntry[] })
  | (MissionImportBase & {
      readonly format: "markdown";
      readonly files: readonly MissionPlanFile[];
    });

export type MissionImportApply = MissionImportSnapshot & {
  readonly previewDigest: string;
  readonly confirmedRetirements: readonly string[];
};

export type MissionRemovedEdge =
  | { readonly kind: "containment"; readonly parentId: string; readonly childId: string }
  | { readonly kind: "dependency"; readonly dependentId: string; readonly dependsOnId: string };

export interface MissionImportViolation {
  readonly code: string;
  readonly message: string;
  readonly filename: string | null;
  readonly nodeId: string | null;
  readonly details: unknown;
}

export interface MissionImportPreview {
  readonly missionId: string;
  readonly expectedMissionVersion: number;
  readonly previewDigest: string;
  readonly creates: readonly string[];
  readonly updates: readonly string[];
  readonly retirements: readonly string[];
  readonly removedEdges: readonly MissionRemovedEdge[];
  readonly noOps: readonly string[];
  readonly violations: readonly MissionImportViolation[];
}

export interface MissionImportResult {
  readonly missionId: string;
  readonly missionVersion: number;
  readonly assignedIds: readonly { readonly filename: string; readonly nodeId: string }[];
}

export type BindingSetKind = "repository" | "worker" | "storage";

export type RepositoryActionName = "pull_request" | "merge_push";

export type RepositoryActionFollows =
  | { readonly type: "assessment_passed" }
  | { readonly type: "action_end_state"; readonly binding: string };

export interface RepositoryBindingConfig {
  readonly available: boolean;
  readonly platform: "github";
  readonly address: string;
  readonly strategy: {
    readonly baseBranch: string;
    readonly action?: {
      readonly name: RepositoryActionName;
      readonly follows: RepositoryActionFollows;
    };
  };
  readonly credential: string;
  readonly projectPrompt?: string;
}

export interface WorkerAgentEntry {
  readonly agent: string;
  readonly agentProvider?: string;
  readonly modelIdentifier?: string;
  readonly reasoningEffort?: string;
}

export interface WorkerBindingConfig {
  readonly worker: string;
  readonly instanceCount: number;
  readonly resourceBudget?: { readonly turns: number; readonly wallTimeMs: number };
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
  readonly projectId: string;
  readonly bindingSetVersion: number;
  readonly changes: readonly {
    readonly kind: "created" | "revised" | "removed" | "unchanged";
    readonly bindingId: string;
  }[];
}

export type MissionActor =
  | { readonly kind: "human"; readonly account: string; readonly name: string }
  | {
      readonly kind: "execution";
      readonly executionId: string;
      readonly clientId: string | null;
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
  readonly bindingId: string;
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
  | { readonly kind: "pull_request"; readonly resourceIdentity: string; readonly number: number }
  | {
      readonly kind: "branch_push";
      readonly resourceIdentity: string;
      readonly branch: string;
      readonly commit: string;
    };

export type MissionAddress =
  MissionRepositoryAddress | MissionProducedAddress | MissionObjectAddress;

export type MissionTestedInput = MissionAddress | readonly MissionRepositoryAddress[];

export interface MissionVerification {
  readonly testedInput: MissionTestedInput;
  readonly results: readonly {
    readonly command: string;
    readonly exitCode: number | null;
    readonly signal: string | null;
    readonly timedOut: boolean;
  }[];
}

interface MissionAssetBase {
  readonly id: string;
  readonly publishedAt: number | null;
  readonly expiredAt: number | null;
}

export type MissionEvidenceAsset =
  | (MissionAssetBase & { readonly kind: "repository"; readonly address: MissionRepositoryAddress })
  | (MissionAssetBase & { readonly kind: "produced"; readonly address: MissionProducedAddress })
  | (MissionAssetBase & {
      readonly kind: "object";
      readonly address: MissionObjectAddress;
      readonly storageBindingId: string;
      readonly size: number;
      readonly mediaType: string;
    })
  | (MissionAssetBase & { readonly kind: "platform"; readonly address: MissionPlatformAddress });

export interface MissionEvidence {
  readonly id: string;
  readonly nodeId: string;
  readonly attempt: number;
  readonly subject: string;
  readonly assets: readonly MissionEvidenceAsset[];
  readonly provenance: MissionActor;
  readonly createdAt: number;
  readonly requirementKey?: string;
  readonly endState?: "expected" | "other";
  readonly verification?: MissionVerification;
}

export interface MissionCurrency {
  readonly current: boolean;
  readonly contextMatches: boolean;
  readonly authorityAdmits: boolean;
  readonly orderSelected: boolean;
  readonly reasons: readonly string[];
}

export interface MissionAssessment {
  readonly id: string;
  readonly nodeId: string;
  readonly executionId: string | null;
  readonly attempt: number;
  readonly nodeRevision: number;
  readonly evidenceIds: readonly string[];
  readonly childOutcomeIds: readonly string[];
  readonly result: MissionAssessmentResult;
  readonly rationale: string;
  readonly testedInput: MissionTestedInput | null;
  readonly actor: MissionActor;
  readonly createdAt: number;
  readonly currency: MissionCurrency | null;
  readonly childNodeIds: readonly string[];
  readonly workerVersion: string | null;
}

export interface MissionOutcome {
  readonly id: string;
  readonly nodeId: string;
  readonly attempt: number;
  readonly nodeRevision: number;
  readonly closingEvent: MissionClosingEvent;
  readonly result: MissionAssessmentResult;
  readonly assessmentId: string;
  readonly evidenceIds: readonly string[];
  readonly createdAt: number;
}

export interface FrozenAction {
  readonly key: string;
  readonly bindingId: string;
  readonly action: RepositoryActionName;
  readonly expectedEndState: "pull_request_merged" | "base_branch_pushed";
  readonly follows: string | null;
  readonly configuration: { readonly baseBranch: string };
}

export interface MissionAttempt {
  readonly nodeId: string;
  readonly attempt: number;
  readonly nodeRevision: number;
  readonly requiredExternalActions: readonly FrozenAction[];
  readonly openedAt: number;
  readonly closedAt: number | null;
  readonly outcomeIds: readonly string[];
  readonly openedBy: MissionActor;
}

export interface MissionExternalAction {
  readonly nodeId: string;
  readonly attempt: number;
  readonly action: FrozenAction;
  readonly requested: boolean;
  readonly requestEvidenceId: string | null;
  readonly resolution: "unrequested" | "unresolved" | "expected-end" | "other-end";
}

export interface MissionBlockedContext {
  readonly outcome: MissionOutcome;
  readonly requests: readonly MissionEvidence[];
}

interface MissionNodeBase {
  readonly id: string;
  readonly filename: string;
  readonly missionId: string;
  readonly parentId: string | null;
  readonly visibleRevision: number;
  readonly content: MissionContent;
  readonly retiredAt: number | null;
  readonly pinnedByAttempts: readonly number[];
}

export interface MissionRunnableNode extends MissionNodeBase {
  readonly kind: "initiative" | "objective";
  readonly state: NodeState;
  readonly attempt: number;
  readonly priority: number;
  readonly dependsOn: readonly string[];
  readonly blockedContext?: MissionBlockedContext;
}

export interface MissionTaskNode extends MissionNodeBase {
  readonly kind: "task";
}

export type MissionNodeRecord = MissionRunnableNode | MissionTaskNode;

export type MissionEdge =
  | { readonly kind: "containment"; readonly parentId: string; readonly childId: string }
  | { readonly kind: "dependency"; readonly dependentId: string; readonly dependsOnId: string };

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
  readonly nodeId: string;
  readonly filename: string;
  readonly revision: number;
  readonly reason: string;
  readonly actor: MissionActor;
  readonly createdAt: number;
  readonly content: MissionContent;
  readonly tasks?: readonly MissionTaskContent[];
  readonly change: {
    readonly write: MissionRevisionWrite;
    readonly previousRevision: number | null;
    readonly changedFields: readonly string[];
    readonly tasks?: readonly {
      readonly id: string;
      readonly change: "created" | "updated" | "moved-in" | "moved-out" | "retired";
      readonly changedFields: readonly string[];
    }[];
  };
  readonly pinnedByAttempts: readonly number[];
}

export interface ProjectBindingRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly kind: BindingSetKind;
  readonly resourceIdentity: string;
  readonly revision: number;
  readonly config: unknown;
  readonly createdAt: number;
  readonly removedAt: number | null;
}

export type ClaimState = "running" | "lost" | "finished";

export interface SchedulerJob {
  readonly jobId: string;
  readonly projectId: string;
  readonly nodeId: string;
  readonly priority: number;
}

export interface SchedulerExecutionRecord {
  readonly executionId: string;
  readonly projectId: string;
  readonly nodeId: string;
  readonly claimant: {
    readonly workerBindingId: string;
    readonly resourceIdentity: string;
    readonly runtimeIdentity: string;
    readonly clientId?: string;
    readonly name?: string;
  };
  readonly attempt: number;
  readonly pinnedRevision: number;
  readonly credentials: readonly string[];
  readonly claimState: ClaimState;
  readonly expiredAt: number;
  readonly createdAt: number;
  readonly endedAt: number | null;
  readonly traceId: string;
  readonly rootSpanId: string;
}

export const CREDENTIAL_PLATFORMS = [
  "github",
  "github-copilot",
  "anthropic",
  "openrouter",
  "openai-compatible",
  "s3",
] as const;

export type CredentialPlatform = (typeof CREDENTIAL_PLATFORMS)[number];

export type SecretShape = "api_key" | "oauth" | "s3_access_key";

export interface CredentialRevision {
  readonly id: string;
  readonly revision: number;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: number;
  readonly endedAt: number | null;
}

export interface Credential {
  readonly name: string;
  readonly platform: CredentialPlatform;
  readonly revisions: readonly CredentialRevision[];
}

export interface CredentialModel {
  readonly id: string;
  readonly contextWindow?: number;
  readonly maxTokens?: number;
  readonly reasoningLevels?: readonly ReasoningEffort[];
}

export interface OpenAiCompatibleMetadata {
  readonly baseUrl: string;
  readonly models: readonly CredentialModel[];
}

export interface S3Metadata {
  readonly endpoint: string;
  readonly bucket: string;
  readonly region: string;
}

export type CredentialMetadata = OpenAiCompatibleMetadata | S3Metadata | null;

export interface ApiKeySecret {
  readonly key: string;
}

export interface OAuthSecret {
  readonly refresh: string;
  readonly access: string;
  readonly expires: number;
}

export interface S3AccessKeySecret {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export type CredentialSecret = ApiKeySecret | OAuthSecret | S3AccessKeySecret;

export interface CredentialCreateBody {
  readonly name: string;
  readonly platform: CredentialPlatform;
  readonly metadata: CredentialMetadata;
  readonly secret: ApiKeySecret | S3AccessKeySecret;
}

export interface CredentialRotateBody {
  readonly expectedRevision: number;
  readonly secret: CredentialSecret;
  readonly metadata?: CredentialMetadata;
}

export interface CredentialMetadataBody {
  readonly expectedRevision: number;
  readonly metadata: CredentialMetadata;
}

export type CredentialLoginMode = "browser" | "device";

export interface CredentialLoginBody {
  readonly platform: CredentialPlatform;
  readonly name: string;
  readonly mode?: CredentialLoginMode;
}

export interface CredentialLoginSession {
  readonly sessionId: string;
  readonly address: string;
  readonly code: string | null;
  readonly expiresAt: number;
}

export type CredentialLoginState = "pending" | "completed" | "failed" | "expired";

export interface CredentialLoginStatus {
  readonly sessionId: string;
  readonly state: CredentialLoginState;
  readonly lastMessage: string | null;
  readonly failureReason: string | null;
}

export type ResourceStatus = "healthy" | "unhealthy" | "unknown";

export interface HealthEntry {
  readonly status: ResourceStatus;
  readonly capability: string;
}

export type HealthResourceMap = Readonly<Record<string, HealthEntry>>;

export interface HealthOwner {
  readonly global: HealthResourceMap;
  readonly projects: Readonly<Record<string, HealthResourceMap>>;
}

export interface HealthReport {
  readonly services: {
    readonly project: HealthOwner;
    readonly intake: HealthOwner;
    readonly worker: HealthOwner;
  };
  readonly shared: {
    readonly custody: HealthOwner;
  };
}
