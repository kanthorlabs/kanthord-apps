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

const STABLE_TEXTS: Readonly<Record<Exclude<PlacementReason, "runtime_failed">, string>> = {
  server_in_container:
    "This server runs in a container, so it cannot start a container for each instance. Keep server.",
  runtime_absent: "Install Podman or Docker on the server host, then open this sheet again.",
  runtime_rootful: "Docker runs as root on this host. Use rootless Podman or rootless Docker.",
};

function isStableReason(
  reason: PlacementReason,
): reason is Exclude<PlacementReason, "runtime_failed"> {
  return reason !== "runtime_failed";
}

export function placementReasonText(reason: PlacementReason, detail: string | null): string {
  if (isStableReason(reason)) return STABLE_TEXTS[reason];
  const cause = (detail ?? "The container runtime does not answer").replace(/\.+$/, "");
  return `${cause}. Start the container runtime, then open this sheet again.`;
}

export function placementChoicesOf(statuses: readonly PlacementStatus[] | null): PlacementChoices {
  if (statuses === null) return { disabled: ["container"], note: null, runtime: null };
  const container = statuses.find((status) => status.placement === "container");
  const runtime =
    container === undefined || container.container_runtime === null
      ? null
      : RUNTIME_LABELS[container.container_runtime];
  if (container === undefined || container.available || container.reason === null)
    return { disabled: [], note: null, runtime };
  const text = placementReasonText(container.reason, container.detail);
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
