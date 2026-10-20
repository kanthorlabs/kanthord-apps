import type { PlacementReason, PlacementStatus, WorkerPlacement } from "@/api/types";

export interface PlacementChoices {
  readonly disabled: readonly WorkerPlacement[];
  readonly note: string | null;
}

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
  if (statuses === null) return { disabled: ["container"], note: null };
  const container = statuses.find((status) => status.placement === "container");
  if (container === undefined || container.available || container.reason === null)
    return { disabled: [], note: null };
  const text = placementReasonText(container.reason, container.detail);
  return isStableReason(container.reason)
    ? { disabled: ["container"], note: `Off. ${text}` }
    : { disabled: [], note: text };
}
