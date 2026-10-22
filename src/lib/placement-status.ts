import type { PlacementReason, PlacementStatus, WorkerPlacement } from "@/api/types";

export interface PlacementChoices {
  readonly disabled: readonly WorkerPlacement[];
  readonly note: string | null;
  readonly runtime: string | null;
}

const RUNTIME_LABELS: Readonly<Record<NonNullable<PlacementStatus["container_runtime"]>, string>> =
  {
    podman: "Podman",
    docker: "Docker",
  };

const STABLE_TEXTS: Readonly<
  Record<Exclude<PlacementReason, "runtime_failed" | "runtime_rootful">, string>
> = {
  server_in_container:
    "This server runs in a container, so it cannot start a container for each instance. Keep server.",
  runtime_absent: "Install Podman or Docker on the server host, then open this sheet again.",
};

function isStableReason(
  reason: PlacementReason,
): reason is Exclude<PlacementReason, "runtime_failed"> {
  return reason !== "runtime_failed";
}

export function placementReasonText(
  reason: PlacementReason,
  detail: string | null,
  runtime: string | null,
): string {
  if (reason === "runtime_rootful")
    return `${runtime ?? "The container runtime"} runs as root on this host. Use rootless Podman or rootless Docker.`;
  if (isStableReason(reason)) return STABLE_TEXTS[reason];
  const cause = (detail ?? "The container runtime does not answer").replace(/\.+$/, "");
  return `${cause}. Fix the container runtime of the server user, then open this sheet again.`;
}

const CHECKING: PlacementChoices = {
  disabled: ["container"],
  note: "Checking the server host…",
  runtime: null,
};

const CHECK_FAILED: PlacementChoices = {
  disabled: ["container"],
  note: "Off. The check of the server host failed. Open this sheet again.",
  runtime: null,
};

export function placementChoicesOf(
  statuses: readonly PlacementStatus[] | "checking" | "failed",
): PlacementChoices {
  if (statuses === "checking") return CHECKING;
  if (statuses === "failed") return CHECK_FAILED;
  const container = statuses.find((status) => status.placement === "container");
  const runtime =
    container === undefined || container.container_runtime === null
      ? null
      : RUNTIME_LABELS[container.container_runtime];
  if (container === undefined || container.available || container.reason === null)
    return { disabled: [], note: null, runtime };
  const text = placementReasonText(container.reason, container.detail, runtime);
  return isStableReason(container.reason)
    ? { disabled: ["container"], note: `Off. ${text}`, runtime }
    : { disabled: [], note: text, runtime };
}

export function containerDescriptionOf(choices: PlacementChoices): string {
  if (choices.disabled.includes("container") && choices.note !== null) return choices.note;
  const runtime = choices.runtime === null ? "" : ` with ${choices.runtime}`;
  const base = `Runs each instance in its own container on the server host${runtime}.`;
  return choices.note === null ? base : `${base} ${choices.note}`;
}
