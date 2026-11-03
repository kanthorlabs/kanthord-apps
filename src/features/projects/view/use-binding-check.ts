import { useCallback, useState } from "react";

import { checkBinding } from "@/api/resources/projects";
import type { BindingSetEntry, HealthEntry, InstructionFileCheck } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { credentialMessage } from "@/features/credentials/credential-message";
import { healthLabel, healthVariant } from "@/lib/credential-health";
import { healthEntryHint } from "@/lib/failure-reason";
import { type InstructionFileView, instructionFileView } from "@/lib/instruction-file";
import type { BindingCheckBadge } from "./use-binding-verify";

interface CheckInputs {
  readonly platform: string;
  readonly address: string;
  readonly sshCredential: string;
  readonly credential: string;
  readonly actionName: string;
  readonly instructionFile: string;
}

interface CheckDraft {
  readonly platform: string;
  readonly address: string;
  readonly sshCredential: string;
  readonly credential: string;
  readonly actionName: string;
  readonly prompts: { readonly instructionFile: string };
}

type CheckResult =
  | { readonly status: "checking" }
  | {
      readonly status: "ready";
      readonly address: HealthEntry;
      readonly sshCredential: HealthEntry;
      readonly credential: HealthEntry | null;
      readonly instructionFile: InstructionFileCheck | null;
      readonly instructionFileHint: string | null;
    }
  | { readonly status: "failed"; readonly message: string };

interface CheckState {
  readonly inputs: CheckInputs;
  readonly result: CheckResult;
}

export interface BindingCheckState {
  readonly addressBadge: BindingCheckBadge | null;
  readonly addressHint: string | null;
  readonly sshCredentialBadge: BindingCheckBadge | null;
  readonly sshCredentialHint: string | null;
  readonly keyRefused: boolean;
  readonly credentialBadge: BindingCheckBadge | null;
  readonly instructionFile: InstructionFileView | null;
  readonly instructionFileHint: string | null;
  readonly checking: boolean;
  readonly error: string | null;
  readonly run: () => void;
}

const CHECKING_BADGE: BindingCheckBadge = { label: "Checking", variant: "outline", busy: true };

function toCheckBadge(entry: HealthEntry): BindingCheckBadge {
  return { label: healthLabel(entry), variant: healthVariant(entry), busy: false };
}

function inputsOf(draft: CheckDraft): CheckInputs {
  return {
    platform: draft.platform,
    address: draft.address,
    sshCredential: draft.sshCredential,
    credential: draft.credential,
    actionName: draft.actionName,
    instructionFile: draft.prompts.instructionFile,
  };
}

function sameInputs(left: CheckInputs, right: CheckInputs): boolean {
  return (
    left.platform === right.platform &&
    left.address === right.address &&
    left.sshCredential === right.sshCredential &&
    left.credential === right.credential &&
    left.actionName === right.actionName &&
    left.instructionFile === right.instructionFile
  );
}

export function useBindingCheck(
  projectId: string,
  draft: CheckDraft,
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
      (answer) =>
        settle({
          status: "ready",
          address: answer.address,
          sshCredential: answer.ssh_credential,
          credential: answer.credential,
          instructionFile: answer.instruction_file,
          instructionFileHint: answer.instruction_file_hint,
        }),
      (cause: unknown) =>
        settle({ status: "failed", message: credentialMessage(asApiError(cause)) }),
    );
  }, [projectId, draft, validate, current]);

  let addressBadge: BindingCheckBadge | null = null;
  let addressHint: string | null = null;
  let sshCredentialBadge: BindingCheckBadge | null = null;
  let sshCredentialHint: string | null = null;
  let keyRefused = false;
  let credentialBadge: BindingCheckBadge | null = null;
  let instructionFile: InstructionFileView | null = null;
  let instructionFileHint: string | null = null;
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
      addressHint = healthEntryHint(current.address, "repository");
      sshCredentialBadge = toCheckBadge(current.sshCredential);
      sshCredentialHint = healthEntryHint(current.sshCredential, "repository");
      keyRefused = current.address.failure_reason === "key_refused";
      credentialBadge = current.credential !== null ? toCheckBadge(current.credential) : null;
      instructionFile =
        current.instructionFile === null ? null : instructionFileView(current.instructionFile);
      instructionFileHint = current.instructionFileHint;
    } else {
      error = current.message;
    }
  }

  return {
    addressBadge,
    addressHint,
    sshCredentialBadge,
    sshCredentialHint,
    keyRefused,
    credentialBadge,
    instructionFile,
    instructionFileHint,
    checking,
    error,
    run,
  };
}
