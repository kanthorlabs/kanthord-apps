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

export type ClaimKind = "steps" | "evaluation";

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

export type BlockCondition =
  | "a current assessment that does not pass"
  | "an External.Failed observation"
  | "a human reason on a paused node";

export type BindingKind = "repository" | "worker" | "provider account" | "source";

export type TransportForm = "SSH" | "HTTPS";

export type RepositoryCapability = "network git read" | "network git write" | "platform action";

export type ExternalActionKind = "fire-and-forget action" | "request-reply action";

export type DeliveryDisposition =
  "acceptance as an observation" | "acceptance as a human act" | "refusal" | "a duplicate";

export type WorkerMethod = "steps method" | "evaluation method";

export type AgentKind = "native agent" | "coding agent";

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

export interface ValidationCriterion {
  readonly id: string;
  readonly text: string;
}

export interface NodeRevision {
  readonly id: string;
  readonly ordinal: number;
  readonly reason: string;
  readonly actor: string;
  readonly time: string;
  /** An attempt pins a revision. A revision that no attempt pins reads null. */
  readonly pinnedByAttempt: string | null;
}

export interface MissionNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly title: string;
  /** A task holds no state. The worker instance manages it inside its execution. */
  readonly state: NodeState | null;
  readonly parentId: string | null;
  /** Only an initiative or an objective carries a dependency edge. */
  readonly dependsOn: readonly string[];
  readonly goal: string;
  readonly steps: readonly string[];
  readonly validationCriteria: readonly ValidationCriterion[];
  readonly verificationCommand: string | null;
  /** An objective names exactly one repository binding of its project. */
  readonly repositoryBindingId: string | null;
  readonly priority: number;
  readonly attemptCounter: number;
  readonly currentRevisionId: string;
}

export interface DependencyClosure {
  readonly nodeId: string;
  /** The nodes this node waits for. It holds no node of their subtrees. */
  readonly members: readonly {
    readonly nodeId: string;
    readonly title: string;
    readonly state: NodeState | null;
  }[];
  readonly holds: boolean;
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

export interface BlockedNode {
  readonly node: MissionNode;
  readonly closedAttempt: Attempt;
  readonly condition: BlockCondition;
}

export interface ControlResult {
  readonly node: MissionNode;
  readonly attempt: Attempt | null;
  readonly outcome: Outcome | null;
  readonly actor: string;
  readonly acceptedAt: string;
}

export interface WorkQueueEntry {
  readonly id: string;
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly admittedClaimKind: ClaimKind;
  readonly priority: number;
  readonly createdAt: string;
  readonly heldOut: boolean;
  readonly waitFact: string | null;
}

export interface Lease {
  readonly expiresAt: string;
  readonly renewedAt: string;
}

export interface Execution {
  readonly id: string;
  readonly projectId: string;
  readonly claimantKind: "worker binding" | "client identity";
  readonly claimantId: string;
  readonly instanceRuntimeId: string | null;
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly attemptId: string;
  readonly pinnedRevisionId: string;
  readonly claimKind: ClaimKind;
  readonly lease: Lease | null;
  readonly live: boolean;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly turnsUsed: number;
  readonly turnBudget: number;
  readonly wallTimeUsedSeconds: number;
  readonly wallTimeBudgetSeconds: number;
}

/** Why a node is not running. The Scheduler rechecks each of these at the claim. */
export interface EligibilityReport {
  readonly nodeId: string;
  readonly checks: readonly {
    readonly name: string;
    readonly holds: boolean;
    readonly detail: string;
  }[];
}

export interface WorkerTemplate {
  readonly name: string;
  readonly method: WorkerMethod;
  readonly agentName: string;
  readonly agentKind: AgentKind;
  readonly declaredNodeStates: readonly NodeState[];
  readonly overridableOptions: readonly string[];
  readonly defaultConfiguration: Readonly<Record<string, string>>;
  readonly turnBudget: number;
  readonly wallTimeBudgetSeconds: number;
}

export interface WorkerInstance {
  readonly runtimeId: string;
  readonly bindingId: string;
  readonly healthcheckPasses: boolean;
  readonly healthcheckDetail: string;
  readonly busy: boolean;
  readonly executionId: string | null;
}

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

export interface CredentialReference {
  readonly capability: string;
  readonly recordId: string;
  readonly recordType: string;
  readonly upstreamPrincipal: string;
  readonly configuringActor: string;
}

export interface RepositoryStrategy {
  readonly baseBranch: string;
  readonly configuredAction: string;
  readonly actionKind: ExternalActionKind;
  readonly expectedEndState: string | null;
}

export interface Binding {
  readonly id: string;
  readonly identity: string;
  readonly kind: BindingKind;
  readonly revision: number;
  readonly disabled: boolean;
  readonly credentialReferences: readonly CredentialReference[];
  /** repository */
  readonly platform?: string;
  readonly repositoryAddress?: string;
  readonly transportForm?: TransportForm;
  readonly requiredCapabilities?: readonly RepositoryCapability[];
  readonly strategy?: RepositoryStrategy;
  /** worker */
  readonly workerName?: string;
  readonly instanceCount?: number;
  readonly available?: boolean;
  readonly agentEntries?: Readonly<Record<string, string>>;
  /** provider account */
  readonly provider?: string;
  readonly account?: string;
  readonly isDefaultAccount?: boolean;
  /** source */
  readonly deliverySource?: string;
}

export interface PermittedClientIdentity {
  readonly id: string;
  readonly clientIdentity: string;
  readonly role: Role;
  readonly executionCount: number;
  readonly liveExecutions: number;
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

export interface StateTally {
  readonly state: NodeState;
  readonly count: number;
}

export interface Overview {
  readonly projectId: string;
  readonly tallies: readonly StateTally[];
  readonly blockedCount: number;
  readonly liveExecutionCount: number;
  readonly instanceCapacity: number;
  readonly instancesHealthy: number;
  readonly inboxDepth: number;
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
