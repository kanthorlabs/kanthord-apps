import { useCallback, useMemo, useState } from "react";

import { isApiError } from "@/api/errors";
import { createWorkerInstance } from "@/api/resources/worker-instances";
import type {
  PlacementReason,
  WorkerInstanceCreateBody,
  WorkerInstanceWriteAnswer,
  WorkerPlacement,
} from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { type ContainerRuntime, type HostKind, instanceNameError } from "@/lib/instance-host";
import { placementChoicesOf, placementReasonText } from "@/lib/placement-status";
import { type HostAddressState, useHostAddress } from "../use-host-address";
import { type PlacementCard, placementCardsOf } from "./placement-cards";
import { usePlacementStatuses } from "./use-placement-statuses";

const NAME_CONFLICT = "worker.instance.name_conflict";
const NAME_INVALID = "worker.instance.name_invalid";
const SERVER_LIMIT = "worker.instance.server_limit";
const PLACEMENT_UNAVAILABLE = "worker.instance.placement_unavailable";

const PLACEMENT_REASONS = [
  "server_in_container",
  "runtime_absent",
  "runtime_failed",
  "runtime_rootful",
] as const satisfies readonly PlacementReason[];

export interface InstanceCreateResult {
  readonly record: WorkerInstanceWriteAnswer;
  readonly configuration: string;
  readonly kind: HostKind;
  readonly runtime: ContainerRuntime;
}

export interface InstanceCreateState {
  readonly open: boolean;
  readonly name: string;
  readonly placement: WorkerPlacement;
  readonly cards: readonly PlacementCard[];
  readonly host: HostAddressState;
  readonly errors: Readonly<Record<string, string>>;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly result: InstanceCreateResult | null;
  readonly missing: readonly string[];
  readonly start: () => void;
  readonly close: () => void;
  readonly dismiss: () => void;
  readonly setName: (name: string) => void;
  readonly selectPlacement: (value: unknown) => void;
  readonly submit: () => void;
}

function detailOf(details: unknown, key: string): unknown {
  return typeof details === "object" && details !== null
    ? (details as Record<string, unknown>)[key]
    : undefined;
}

function reasonOf(details: unknown): PlacementReason | null {
  const reason = detailOf(details, "reason");
  return PLACEMENT_REASONS.find((known) => known === reason) ?? null;
}

function placementOf(value: unknown, cards: readonly PlacementCard[]): WorkerPlacement | null {
  return cards.find((card) => card.value === value && !card.disabled)?.value ?? null;
}

function fieldErrorOf(
  cause: unknown,
  name: string,
  reasonText: (reason: PlacementReason) => string,
): Record<string, string> | null {
  if (!isApiError(cause)) return null;
  if (cause.detail === SERVER_LIMIT) {
    const limit = detailOf(cause.details, "limit");
    return {
      placement:
        typeof limit === "number"
          ? `This server runs ${limit} server instances, the limit. Archive one, or raise worker.server_instance_limit.`
          : cause.message,
    };
  }
  if (cause.detail === PLACEMENT_UNAVAILABLE) {
    const reason = reasonOf(cause.details);
    return { placement: reason === null ? cause.message : reasonText(reason) };
  }
  if (cause.detail === NAME_CONFLICT) {
    return {
      name: `The name ${name} is taken by a live or an archived instance. Choose another name.`,
    };
  }
  if (cause.detail === NAME_INVALID) return { name: cause.message };
  return null;
}

export function useInstanceCreate(workerName: string, onCreated: () => void): InstanceCreateState {
  const [open, setOpen] = useState(false);
  const [name, setNameValue] = useState("");
  const [placement, setPlacement] = useState<WorkerPlacement>("server");
  const [opening, setOpening] = useState(0);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InstanceCreateResult | null>(null);
  const host = useHostAddress(open);
  const resetHost = host.reset;
  const statuses = usePlacementStatuses(opening);
  const choices = useMemo(() => placementChoicesOf(statuses), [statuses]);
  const cards = useMemo(() => placementCardsOf(choices), [choices]);
  const containerDetail =
    typeof statuses === "string"
      ? null
      : (statuses.find((status) => status.placement === "container")?.detail ?? null);

  const start = useCallback(() => {
    setNameValue("");
    setPlacement("server");
    setOpening((count) => count + 1);
    setErrors({});
    setFailure(null);
    setResult(null);
    resetHost();
    setOpen(true);
  }, [resetHost]);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    setResult(null);
    resetHost();
  }, [submitting, resetHost]);

  const dismiss = useCallback(() => {
    if (result === null) close();
  }, [result, close]);

  const setName = useCallback((next: string) => {
    setNameValue(next);
    setErrors((current) => {
      const { name: _dropped, ...rest } = current;
      return rest;
    });
  }, []);

  const selectPlacement = useCallback(
    (value: unknown) => {
      const next = placementOf(value, cards);
      if (next === null) return;
      setPlacement(next);
      setErrors((current) => {
        const { placement: _dropped, ...rest } = current;
        return rest;
      });
    },
    [cards],
  );

  const submit = useCallback(() => {
    if (submitting) return;
    const atWorker = placement === "worker";
    const nameError = instanceNameError(name);
    const addressError = host.kind === null ? null : host.addressError();
    const card = cards.find((candidate) => candidate.value === placement);
    const next: Record<string, string> = {};
    if (nameError !== null) next["name"] = nameError;
    if (card?.disabled) next["placement"] = card.description;
    if (atWorker && host.kind === null) next["kind"] = "Choose where the instance runs.";
    if (atWorker && addressError !== null) next["address"] = addressError;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const kind = host.kind;
    const runtime = host.runtime;
    const reasonText = (reason: PlacementReason) =>
      placementReasonText(reason, containerDetail, choices.runtime);
    const body: WorkerInstanceCreateBody = atWorker
      ? { name, worker: workerName, placement, endpoint: host.address.trim() }
      : { name, worker: workerName, placement };
    setSubmitting(true);
    setFailure(null);
    createWorkerInstance(body).then(
      (record) => {
        setSubmitting(false);
        onCreated();
        if (!atWorker || kind === null) {
          setOpen(false);
          return;
        }
        if (record.instance_configuration === undefined) {
          setFailure(
            "The server answered no instance configuration. Use Reset key on the instance page.",
          );
          return;
        }
        setResult({ record, configuration: record.instance_configuration, kind, runtime });
      },
      (cause: unknown) => {
        setSubmitting(false);
        const fields = fieldErrorOf(cause, name, reasonText);
        if (fields !== null) setErrors(fields);
        else setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, placement, name, host, cards, choices, containerDetail, workerName, onCreated]);

  const atWorker = placement === "worker";
  const missing = [
    ...(name.length === 0 ? ["Name"] : []),
    ...(atWorker && host.kind === null ? ["Where does it run?"] : []),
    ...(atWorker && host.kind !== null && host.address.trim().length === 0 ? ["Address"] : []),
  ];

  return {
    open,
    name,
    placement,
    cards,
    host,
    errors,
    failure,
    submitting,
    result,
    missing,
    start,
    close,
    dismiss,
    setName,
    selectPlacement,
    submit,
  };
}
