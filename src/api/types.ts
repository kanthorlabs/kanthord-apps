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

export const TERMINAL_STATES = ["Completed", "Discarded"] as const satisfies readonly NodeState[];

export type TerminalState = (typeof TERMINAL_STATES)[number];

export type Role = "executor" | "reviewer";

export type AssessmentActor =
  | { readonly kind: "human"; readonly account: string; readonly name: string }
  | {
      readonly kind: "execution";
      readonly executionId: string;
      readonly clientId: string | null;
      readonly name: string;
    };

export type AssertedResult = "success" | "criteria not met" | "nothing established";

export type AssessmentVerdict = "meets" | "does not meet" | "neither established";

export type CurrencyCheck = "context" | "authority" | "order";

export type ExternalActionKind = "fire-and-forget action" | "request-reply action";

export type DeliveryDisposition =
  "acceptance as an observation" | "acceptance as a human act" | "refusal" | "a duplicate";

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

export interface EvidenceRecord {
  readonly id: string;
  readonly attemptId: string;
  readonly contentAddress: string;
  readonly subject: string;
  readonly provenance: string;
  readonly scope: string;
  /** An evidence record states that redaction transformed its content. */
  readonly redacted: boolean;
  readonly time: string;
}

export interface Assessment {
  readonly id: string;
  readonly attemptId: string;
  readonly nodeRevisionId: string;
  readonly evidenceIds: readonly string[];
  readonly childOutcomeIds: readonly string[];
  readonly verdict: AssessmentVerdict;
  readonly method: string;
  readonly actor: AssessmentActor;
  readonly time: string;
  /** An assessment is current only when all three checks admit it. */
  readonly currency: Readonly<Record<CurrencyCheck, boolean>> | null;
}

export interface Outcome {
  readonly id: string;
  readonly attemptId: string;
  readonly assertedResult: AssertedResult;
  readonly closingEvent: string;
  readonly stoppingReason: string;
  readonly assessmentId: string;
  readonly evidenceIds: readonly string[];
  /** Set when this outcome corrects one. kanthord keeps the previous outcome. */
  readonly previousOutcomeId: string | null;
  readonly actor: string;
  readonly time: string;
}

export interface ExternalObject {
  readonly id: string;
  readonly attemptId: string;
  readonly action: string;
  readonly actionKind: ExternalActionKind;
  readonly repositoryBindingId: string;
  readonly address: string;
  readonly label: string;
  readonly expectedEndState: string | null;
  readonly observedState: string | null;
  readonly resolved: boolean;
}

export interface Attempt {
  readonly id: string;
  readonly nodeId: string;
  readonly ordinal: number;
  readonly pinnedRevisionId: string;
  readonly open: boolean;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly evidence: readonly EvidenceRecord[];
  readonly assessments: readonly Assessment[];
  readonly outcome: Outcome | null;
  readonly externalObjects: readonly ExternalObject[];
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

export interface Delivery {
  readonly id: string;
  readonly source: string;
  readonly platformDeliveryIdentity: string;
  readonly disposition: DeliveryDisposition;
  readonly receivedAt: string;
  readonly externalObjectId: string | null;
  readonly nodeId: string | null;
  readonly attemptId: string | null;
  readonly decodedEventType: string | null;
  readonly refusalReason: string | null;
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
