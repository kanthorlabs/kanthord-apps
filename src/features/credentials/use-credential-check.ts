import { useCallback } from "react";
import { toast } from "sonner";

import type { CredentialComponent } from "@/api/types";
import { healthLabel, healthVariant, type HealthBadgeVariant } from "@/lib/credential-health";
import { utcDateTime } from "@/lib/format";
import { type CredentialHealthState, useCredentialHealth } from "./use-credential-health";

const NO_FACT = "—";

export interface CheckBadge {
  readonly label: string;
  readonly variant: HealthBadgeVariant;
  readonly busy: boolean;
}

export interface CredentialCheck {
  readonly badge: CheckBadge | null;
  readonly capability: string;
  readonly checkedAt: string;
  readonly checking: boolean;
  readonly verify: () => void;
}

function checkBadge(state: CredentialHealthState): CheckBadge | null {
  if (state.status === "checking") return { label: "Checking", variant: "outline", busy: true };
  if (state.status === "failed") {
    return { label: "Check failed", variant: "destructive", busy: false };
  }
  if (state.status === "ready") {
    const { entry } = state;
    return { label: healthLabel(entry), variant: healthVariant(entry), busy: false };
  }
  return null;
}

function capabilityOf(state: CredentialHealthState): string {
  if (state.status !== "ready") return NO_FACT;
  return state.entry.capability;
}

function checkedAtOf(state: CredentialHealthState): string {
  return state.status === "ready" ? utcDateTime(state.checkedAt) : NO_FACT;
}

export function useCredentialCheck(component: CredentialComponent, name: string): CredentialCheck {
  const announceFailure = useCallback(
    (message: string, retry: () => void) => {
      toast.error(`Verifying ${name} failed.`, {
        description: message,
        action: { label: "Retry", onClick: retry },
      });
    },
    [name],
  );
  const { state, verify } = useCredentialHealth(component, name, announceFailure);

  return {
    badge: checkBadge(state),
    capability: capabilityOf(state),
    checkedAt: checkedAtOf(state),
    checking: state.status === "checking",
    verify,
  };
}
