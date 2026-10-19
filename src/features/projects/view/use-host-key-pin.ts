import { useCallback, useState } from "react";

import { ApiError } from "@/api/errors";
import { listHostKeys, pinHostKey, scanHostKey } from "@/api/resources/credentials";
import type { HostKey, HostKeyScan } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import { credentialMessage } from "@/features/credentials/credential-message";

type PinRead =
  | { readonly status: "pinned"; readonly key: HostKey; readonly pinnedNow: boolean }
  | { readonly status: "unconfirmed"; readonly scan: HostKeyScan }
  | { readonly status: "changed"; readonly scanned: string; readonly presented: string };

export type HostKeyPinView =
  | { readonly status: "none" }
  | { readonly status: "reading"; readonly host: string }
  | { readonly status: "failed"; readonly host: string; readonly message: string }
  | ({ readonly host: string } & Extract<PinRead, { status: "pinned" | "changed" }>)
  | {
      readonly status: "unconfirmed";
      readonly host: string;
      readonly scan: HostKeyScan;
      readonly pinning: boolean;
      readonly error: string | null;
    };

export interface HostKeyPinState {
  readonly view: HostKeyPinView;
  readonly ready: boolean;
  readonly confirm: () => void;
  readonly retry: () => void;
}

function presentedFingerprintOf(cause: unknown): string | null {
  if (!(cause instanceof ApiError) || cause.detail !== "repository.host_key.changed") return null;
  const details = cause.details;
  if (typeof details !== "object" || details === null) return null;
  const fingerprint: unknown = (details as Readonly<Record<string, unknown>>)["fingerprint"];
  return typeof fingerprint === "string" ? fingerprint : null;
}

async function pinScanned(scan: HostKeyScan): Promise<PinRead> {
  try {
    const key = await pinHostKey(scan.host, { fingerprint: scan.fingerprint });
    return { status: "pinned", key, pinnedNow: true };
  } catch (cause) {
    const presented = presentedFingerprintOf(cause);
    if (presented === null) throw cause;
    return { status: "changed", scanned: scan.fingerprint, presented };
  }
}

type PinOutcome = PinRead | { readonly status: "failed"; readonly message: string };

interface HostRead {
  readonly host: string;
  readonly outcome: PinOutcome;
}

function failedOf(cause: unknown): PinOutcome {
  return { status: "failed", message: credentialMessage(asApiError(cause)) };
}

async function readPin(host: string): Promise<PinRead> {
  const pinned = (await listHostKeys()).find((key) => key.host === host);
  if (pinned !== undefined) return { status: "pinned", key: pinned, pinnedNow: false };
  const scan = await scanHostKey(host);
  return scan.source === "github_meta" ? pinScanned(scan) : { status: "unconfirmed", scan };
}

async function readHost(host: string | null): Promise<HostRead | null> {
  if (host === null) return null;
  const outcome = await readPin(host).catch(failedOf);
  return { host, outcome };
}

interface Confirmation {
  readonly host: string;
  readonly pinning: boolean;
  readonly error: string | null;
  readonly read: PinRead | null;
}

function viewOf(
  host: string | null,
  read: HostRead | null,
  own: Confirmation | null,
): HostKeyPinView {
  if (host === null) return { status: "none" };
  const outcome = own?.read ?? (read?.host === host ? read.outcome : null);
  if (outcome === null) return { status: "reading", host };
  if (outcome.status !== "unconfirmed") return { ...outcome, host };
  return { ...outcome, host, pinning: own?.pinning ?? false, error: own?.error ?? null };
}

export function useHostKeyPin(host: string | null): HostKeyPinState {
  const pin = useResource(() => readHost(host), [host]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [retriedRead, setRetriedRead] = useState<HostRead | null>(null);
  const own = confirmation !== null && confirmation.host === host ? confirmation : null;
  const current = pin.data !== null && pin.data === retriedRead ? null : pin.data;
  const view = viewOf(host, current, own);

  const scan = view.status === "unconfirmed" && !view.pinning ? view.scan : null;
  const confirm = useCallback(() => {
    if (scan === null) return;
    const started = scan.host;
    setConfirmation({ host: started, pinning: true, error: null, read: null });
    pinScanned(scan).then(
      (next) => setConfirmation({ host: started, pinning: false, error: null, read: next }),
      (cause: unknown) =>
        setConfirmation({
          host: started,
          pinning: false,
          error: credentialMessage(asApiError(cause)),
          read: null,
        }),
    );
  }, [scan]);

  const { reload, data } = pin;
  const retry = useCallback(() => {
    setConfirmation(null);
    setRetriedRead(data);
    reload();
  }, [reload, data]);

  return { view, ready: view.status === "none" || view.status === "pinned", confirm, retry };
}
