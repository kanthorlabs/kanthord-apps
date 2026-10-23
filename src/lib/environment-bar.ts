import type { EnvironmentState, EnvironmentStatus } from "@/api/types";

export const ACTIVE_ENVIRONMENT_STATUSES: readonly EnvironmentStatus[] = [
  "pending",
  "building",
  "proving",
];
export const ENVIRONMENT_ACTIVE_POLL_MS = 5000;
export const ENVIRONMENT_IDLE_POLL_MS = 30000;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export interface StepProgress {
  readonly step: number;
  readonly of: number;
}

const STATUS_LABELS: Readonly<Record<EnvironmentStatus, string>> = {
  none: "None",
  pending: "Pending",
  building: "Building",
  proving: "Proving",
  ready: "Ready",
  failed: "Failed",
};

const STEP_LINES: Readonly<Record<EnvironmentStatus, string>> = {
  none: "No environment",
  pending: "Reading the repository",
  building: "Building the image",
  proving: "Proving on the base branch head",
  ready: "Ready",
  failed: "Failed",
};

const IMAGE_STEPS: Readonly<Partial<Record<EnvironmentStatus, number>>> = {
  pending: 1,
  building: 2,
  proving: 3,
  ready: 3,
};

const HOST_STEPS: Readonly<Partial<Record<EnvironmentStatus, number>>> = {
  pending: 1,
  proving: 2,
  ready: 2,
};

function isActive(state: EnvironmentState): boolean {
  return ACTIVE_ENVIRONMENT_STATUSES.includes(state.status);
}

function isOpen(state: EnvironmentState): boolean {
  return isActive(state) || state.status === "failed";
}

function startsBefore(left: EnvironmentState, right: EnvironmentState): boolean {
  if (left.run_started_at === null) return false;
  return right.run_started_at === null || left.run_started_at < right.run_started_at;
}

export function environmentPollMs(states: readonly EnvironmentState[] | null): number {
  const active = states !== null && states.some(isActive);
  return active ? ENVIRONMENT_ACTIVE_POLL_MS : ENVIRONMENT_IDLE_POLL_MS;
}

export function shownEnvironmentOf(states: readonly EnvironmentState[]): EnvironmentState | null {
  const failed = states.find((state) => state.status === "failed");
  if (failed !== undefined) return failed;
  let earliest: EnvironmentState | null = null;
  for (const state of states) {
    if (!isActive(state)) continue;
    if (earliest === null || startsBefore(state, earliest)) earliest = state;
  }
  return earliest;
}

export function moreCountOf(states: readonly EnvironmentState[], shown: EnvironmentState): number {
  return states.filter((state) => state.binding_id !== shown.binding_id && isOpen(state)).length;
}

export function environmentStatusLabel(status: EnvironmentStatus): string {
  return STATUS_LABELS[status];
}

export function environmentStatusVariant(
  status: EnvironmentStatus,
): "destructive" | "outline" | "secondary" {
  if (status === "failed") return "destructive";
  if (status === "ready" || status === "none") return "outline";
  return "secondary";
}

export function stepLineOf(state: EnvironmentState): string {
  if (state.status === "failed") {
    return state.failure === null
      ? STEP_LINES.failed
      : `Failed: ${state.failure.class} · ${state.failure.command}`;
  }
  if (state.status === "pending" && state.reason !== null) return `Waiting: ${state.reason}`;
  const queued = state.status === "building" || state.status === "proving";
  if (queued && state.run_started_at === null) return "Waiting for another run";
  return STEP_LINES[state.status];
}

export function stepProgressOf(state: EnvironmentState): StepProgress | null {
  if (state.target === "remote") return null;
  const image = state.target === "image";
  const step = (image ? IMAGE_STEPS : HOST_STEPS)[state.status];
  return step === undefined ? null : { step, of: image ? 3 : 2 };
}

export function elapsedText(startedAt: number | null, now: number): string | null {
  if (startedAt === null) return null;
  const elapsed = Math.max(0, now - startedAt);
  if (elapsed < MINUTE_MS) return `${Math.floor(elapsed / SECOND_MS)} s`;
  return `${Math.floor(elapsed / MINUTE_MS)} min`;
}

export function stepElapsedOf(state: EnvironmentState, now: number): string | null {
  if (state.run_started_at === null || !isActive(state)) return null;
  return elapsedText(state.step_started_at, now);
}
