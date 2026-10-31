import { useCallback, useState } from "react";
import { toast } from "sonner";

import { verifyCredential } from "@/api/resources/credentials";
import { rebuildEnvironment } from "@/api/resources/projects";
import type { HealthEntry } from "@/api/types";
import { credentialMessage } from "@/features/credentials/credential-message";
import { ENVIRONMENT_RUN_ACTIVE } from "@/features/projects/view/use-binding-environment";
import { asApiError } from "@/hooks/use-resource";
import type { AttentionItem } from "@/lib/attention";
import type { ActedAct } from "@/lib/board-done";
import { CHECKING_LABEL } from "@/lib/check-result";
import { healthLabel } from "@/lib/credential-health";

import { type ActFailure, reportActFailure } from "./use-board-tool-acts";

export interface VerifyState {
  readonly checking: boolean;
  readonly label: string | null;
  readonly verify: () => void;
}

export interface OnboardingState {
  readonly running: boolean;
  readonly failure: ActFailure | null;
  readonly run: () => void;
}

export interface BoardChecks {
  readonly verify: VerifyState;
  readonly onboarding: OnboardingState;
}

interface ChecksContext {
  readonly reload: () => void;
  readonly markActed: (itemId: string, act?: ActedAct) => void;
}

const CHECK_FAILED_LABEL = "Check failed";
const ONBOARDING_DOING = "Starting the onboarding of";

function verifyLabelOf(entry: HealthEntry): string {
  if (entry.status === "unhealthy" && entry.failure_reason !== null) {
    return `Refused: ${entry.failure_reason}`;
  }
  return healthLabel(entry);
}

export function useBoardChecks(
  item: AttentionItem,
  { reload, markActed }: ChecksContext,
): BoardChecks {
  const [checking, setChecking] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<ActFailure | null>(null);
  const credential = item.kind === "credential_refused" ? item.credential : null;
  const binding = item.kind === "environment_failed" ? item : null;
  const bindingId = binding?.bindingId ?? null;
  const bindingName = binding?.binding ?? "";
  const projectId = binding?.project.id ?? "";
  const itemId = item.id;

  const verify = useCallback(
    function attempt() {
      if (credential === null || checking) return;
      setChecking(true);
      setLabel(CHECKING_LABEL);
      verifyCredential("llm", credential).then(
        (entry) => {
          setChecking(false);
          setLabel(verifyLabelOf(entry));
        },
        (cause: unknown) => {
          setChecking(false);
          setLabel(CHECK_FAILED_LABEL);
          toast.error(`Verifying ${credential} failed.`, {
            description: credentialMessage(asApiError(cause)),
            action: { label: "Retry", onClick: attempt },
          });
        },
      );
    },
    [credential, checking],
  );

  const run = useCallback(
    function attempt() {
      if (bindingId === null || running) return;
      setRunning(true);
      setFailure(null);
      rebuildEnvironment(projectId, bindingId).then(
        () => {
          setRunning(false);
          toast.success(`Onboarding of ${bindingName} started.`);
          markActed(itemId, { id: "onboarding" });
          reload();
        },
        (cause: unknown) => {
          setRunning(false);
          const refusal = asApiError(cause);
          if (refusal.status === 409 && refusal.detail === ENVIRONMENT_RUN_ACTIVE) {
            toast.info(`An onboarding run of ${bindingName} is active.`);
            reload();
            return;
          }
          setFailure(reportActFailure(ONBOARDING_DOING, bindingName, cause, attempt));
        },
      );
    },
    [bindingId, bindingName, projectId, running, itemId, markActed, reload],
  );

  return {
    verify: { checking, label, verify },
    onboarding: { running, failure, run },
  };
}
