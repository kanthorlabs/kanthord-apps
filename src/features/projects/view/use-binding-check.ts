import { useCallback, useState } from "react";

import { checkBinding } from "@/api/resources/projects";
import type { BindingSetEntry, HealthEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { credentialMessage } from "@/features/credentials/credential-message";
import { healthLabel, healthVariant } from "@/lib/credential-health";
import type { BindingCheckBadge } from "./use-binding-verify";

interface CheckInputs {
  readonly platform: string;
  readonly address: string;
  readonly sshCredential: string;
  readonly credential: string;
  readonly actionName: string;
}

type CheckResult =
  | { readonly status: "checking" }
  | {
      readonly status: "ready";
      readonly address: HealthEntry;
      readonly sshCredential: HealthEntry;
      readonly credential: HealthEntry | null;
    }
  | { readonly status: "failed"; readonly message: string };

interface CheckState {
  readonly inputs: CheckInputs;
  readonly result: CheckResult;
}

export interface BindingCheckState {
  readonly addressBadge: BindingCheckBadge | null;
  readonly sshCredentialBadge: BindingCheckBadge | null;
  readonly credentialBadge: BindingCheckBadge | null;
  readonly checking: boolean;
  readonly error: string | null;
  readonly run: () => void;
}

const CHECKING_BADGE: BindingCheckBadge = { label: "Checking", variant: "outline", busy: true };

function toCheckBadge(entry: HealthEntry): BindingCheckBadge {
  return { label: healthLabel(entry), variant: healthVariant(entry), busy: false };
}

function inputsOf(draft: {
  readonly platform: string;
  readonly address: string;
  readonly sshCredential: string;
  readonly credential: string;
  readonly actionName: string;
}): CheckInputs {
  return {
    platform: draft.platform,
    address: draft.address,
    sshCredential: draft.sshCredential,
    credential: draft.credential,
    actionName: draft.actionName,
  };
}

function sameInputs(left: CheckInputs, right: CheckInputs): boolean {
  return (
    left.platform === right.platform &&
    left.address === right.address &&
    left.sshCredential === right.sshCredential &&
    left.credential === right.credential &&
    left.actionName === right.actionName
  );
}

export function useBindingCheck(
  projectId: string,
  draft: {
    readonly platform: string;
    readonly address: string;
    readonly sshCredential: string;
    readonly credential: string;
    readonly actionName: string;
  },
  validate: () => BindingSetEntry | null,
): BindingCheckState {
  const [checkState, setCheckState] = useState<CheckState | null>(null);

  const currentInputs = inputsOf(draft);
  const current =
    checkState !== null && sameInputs(checkState.inputs, currentInputs) ? checkState.result : null;

  const run = useCallback(() => {
    if (current?.status === "checking") return;
    const entry = validate();
    if (entry === null) return;
    const started = inputsOf(draft);
    const settle = (result: CheckResult) =>
      setCheckState((prev) =>
        prev !== null && !sameInputs(prev.inputs, started) ? prev : { inputs: started, result },
      );
    setCheckState({ inputs: started, result: { status: "checking" } });
    checkBinding(projectId, entry).then(
      ({ address, ssh_credential: sshCredential, credential }) =>
        settle({ status: "ready", address, sshCredential, credential }),
      (cause: unknown) =>
        settle({ status: "failed", message: credentialMessage(asApiError(cause)) }),
    );
  }, [projectId, draft, validate, current]);

  let addressBadge: BindingCheckBadge | null = null;
  let sshCredentialBadge: BindingCheckBadge | null = null;
  let credentialBadge: BindingCheckBadge | null = null;
  let checking = false;
  let error: string | null = null;

  if (current !== null) {
    if (current.status === "checking") {
      addressBadge = CHECKING_BADGE;
      sshCredentialBadge = CHECKING_BADGE;
      credentialBadge = CHECKING_BADGE;
      checking = true;
    } else if (current.status === "ready") {
      addressBadge = toCheckBadge(current.address);
      sshCredentialBadge = toCheckBadge(current.sshCredential);
      credentialBadge = current.credential !== null ? toCheckBadge(current.credential) : null;
    } else {
      error = current.message;
    }
  }

  return { addressBadge, sshCredentialBadge, credentialBadge, checking, error, run };
}
