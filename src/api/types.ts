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

export interface Session {
  readonly token: string;
  readonly username: string;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly missionRevision: string;
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

export interface ObservationRecord {
  readonly id: string;
  readonly externalObjectId: string;
  readonly observedState: string;
  readonly observedAt: string;
  readonly landedCommitIds: readonly string[];
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
