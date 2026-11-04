import type {
  CleanableKind,
  CleanupRefusal,
  CleanupRuleName,
  CleanupState,
  FootprintAlertState,
  FootprintKind,
  WorkerPlacement,
} from "@/api/types";

export const FOOTPRINT_DEFAULT_AGE_DAYS = 30;
export const FOOTPRINT_CLEANUP_KEYS_MAX = 1000;
export const FOOTPRINT_OLDER_THAN_DAYS_MAX = 3650;
export const FOOTPRINT_SUMMARY_POLL_MS = 60_000;
export const FOOTPRINT_OPEN_ALERTS_LIMIT = 100;
export const SERVER_HOST_LABEL = "server";

export const FOOTPRINT_KIND_LABELS: Readonly<Record<FootprintKind, string>> = {
  operational_database: "Operational database",
  trace: "Traces",
  database_backup: "Database backups",
  log: "Logs",
  environment: "Environments",
  cache_volume: "Cache volumes",
  slot_image: "Slot images",
  slot_residue: "Slot residue",
  intake_mirror: "Intake mirrors",
  workbench: "Workbench",
  session: "Agent sessions",
  workspace: "Node workspaces",
  tool_output: "Tool output files",
  disk: "Disk",
};

const ITEM_NOUNS: Readonly<Record<CleanableKind, readonly [string, string]>> = {
  trace: ["trace", "traces"],
  database_backup: ["database backup", "database backups"],
  environment: ["environment", "environments"],
  cache_volume: ["cache volume", "cache volumes"],
  slot_image: ["slot image", "slot images"],
  session: ["agent session", "agent sessions"],
  workspace: ["node workspace", "node workspaces"],
  tool_output: ["tool output file", "tool output files"],
};

export function itemNoun(kind: CleanableKind, count: number): string {
  const [one, many] = ITEM_NOUNS[kind];
  return count === 1 ? one : many;
}

export const ALERT_STATE_LABELS: Readonly<Record<FootprintAlertState, string | null>> = {
  ok: null,
  pending: "Pending",
  firing: "Above threshold",
  recovering: "Recovering",
};

export const CLEANUP_STATE_NOTES: Readonly<Partial<Record<CleanupState, string>>> = {
  queued: "The cleanup waits for its owner. The record updates every 15 seconds.",
  running: "The owner deletes the keys. The record updates every 15 seconds.",
  failed:
    "The owner could not run the cleanup. The outcome holds the keys that it removed before the failure. KanthorD rolls back nothing.",
  cancelled: "A human cancelled the cleanup before it ran. KanthorD deleted nothing.",
};

export const CLEANUP_STATE_LABELS: Readonly<Record<CleanupState, string>> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const RULE_LABELS: Readonly<Record<CleanupRuleName, string>> = {
  older_than: "Older than an age",
  node_closed: "Workspace of a closed node",
  unbound: "Not bound to a project",
  superseded: "Superseded by a newer one",
  dangling: "Untagged image",
};

export const EVERY_ITEM_LABEL = "Pick from every item";

const LIVE_TEXTS: Readonly<Record<CleanableKind, string>> = {
  trace: "In use by a running execution.",
  database_backup: "In use by KanthorD.",
  environment: "In use by a binding or a live container.",
  cache_volume: "In use by a binding or a live container.",
  slot_image: "In use by the configured image or a live container.",
  session: "In use by a running execution.",
  workspace: "In use by a running execution.",
  tool_output: "In use by a running execution.",
};

export function refusalText(kind: CleanableKind, refusal: CleanupRefusal): string {
  return refusal === "live"
    ? LIVE_TEXTS[kind]
    : "KanthorD cannot read this item safely, so it keeps it.";
}

export const KEPT_BACKUP_TEXT = "Kept: the newest backup of this file.";

export const CONSEQUENCE_TEXTS: Readonly<Record<CleanableKind, string>> = {
  trace:
    "The spans, records, telemetry texts and session entries of each trace go with it. The flow rollups, the execution rows and every Mission record stay. A read of the trace then answers not found.",
  database_backup: "The database stays.",
  environment:
    "The image tags and the proof file of each environment go. The binding stays, and the next proof builds the environment again.",
  cache_volume: "The binding stays, and the next build fills a new volume.",
  slot_image: "The configured image of the running version stays.",
  session:
    "The pi session directory of each execution goes. The trace and its session entries stay. A session rebuild then answers that the session is not kept.",
  workspace: "The node branch on the remote and the evidence stay.",
  tool_output:
    "The session entry that names the path stays, and a later read of the path by the agent fails.",
};

export const WORKSPACE_LOSS_TEXT =
  "A later execution of the node clones again and installs its dependencies again. Uncommitted files of a closed node are lost.";

export const OLDER_THAN_SAFER_TEXT = "Narrow the set with a larger age, for example 60 days.";
export const HAND_PICK_SAFER_TEXT = "Narrow the set: clear the items to keep in the list.";

const INSTANCE_CLEANABLE: readonly CleanableKind[] = ["session", "workspace", "tool_output"];

export function cleanupTimingText(
  kind: CleanableKind,
  placement: WorkerPlacement | null,
): string | null {
  if (!INSTANCE_CLEANABLE.includes(kind) || placement === null) return null;
  if (placement === "worker") {
    return "The instance runs the cleanup when it reads its work, within 15 seconds while it runs.";
  }
  if (kind === "session") return "KanthorD deletes these sessions at once.";
  return "The instance runs the cleanup at its next report, within 15 minutes while it runs.";
}

export function noDeleteText(kind: FootprintKind, placement: WorkerPlacement | null): string {
  if (kind === "log") return "The operator rotates kanthord.log. KanthorD rotates no log.";
  if (kind === "slot_residue") {
    return placement === "worker"
      ? "The operator removes the files in <unit>/tmp on the host."
      : "Archive the instance to remove its slot.";
  }
  if (kind === "operational_database") {
    return "KanthorD deletes no table here. Each row of the breakdown names the owner path of its records.";
  }
  if (kind === "disk") return "Free the space through the kinds on this device.";
  return "KanthorD offers no cleanup for this kind. It shows statistics only.";
}

export const TABLE_OWNER_TEXTS: Readonly<Record<string, string>> = {
  "mission.evidence.delete":
    "Delete evidence from the evidence list of its node on the project page.",
  "intake.inbound.event.delete": "Delete inbound events with kanthord intake event delete.",
  "intake.outbound.request.delete":
    "Delete outbound requests with kanthord intake outbound delete.",
};

export const INSTANCE_STALE_TEXT =
  "The instance does not report. Bind the instance to clean its workspaces, or archive it to remove its slot.";
export const SERVER_STALE_TEXT = "The server does not measure. Run Measure now.";

export const PRESET_LABEL = "Executions older than 30 days";

export const PRESET_CONSEQUENCE_TEXT =
  "The spans, records, telemetry texts and session entries of each trace go with it, and the pi session directory of each execution goes on its instance. The execution rows and every Mission record stay.";

export function isFootprintKind(value: string): value is FootprintKind {
  return Object.hasOwn(FOOTPRINT_KIND_LABELS, value);
}

export function isCleanableKind(kind: FootprintKind): kind is CleanableKind {
  return Object.hasOwn(ITEM_NOUNS, kind);
}
