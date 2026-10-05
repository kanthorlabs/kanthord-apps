import { useCallback, useState } from "react";

import { checkCredential } from "@/api/resources/credentials";
import type { CredentialComponent, CredentialPlatformEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import {
  checkBodyOf,
  type DraftErrors,
  type MetadataDraft,
  type SecretDraft,
} from "@/lib/credential-draft";
import { healthLabel, healthVariant } from "@/lib/credential-health";
import { credentialMessage } from "../credential-message";
import type { CheckBadge } from "../use-credential-check";

interface Inputs {
  readonly platform: string;
  readonly secret: SecretDraft;
  readonly metadata: MetadataDraft;
}

type PrecheckResult =
  | { readonly status: "checking" }
  | { readonly status: "ready"; readonly badge: CheckBadge }
  | { readonly status: "failed"; readonly message: string };

interface Precheck {
  readonly inputs: Inputs;
  readonly result: PrecheckResult;
}

export interface CredentialPrecheck {
  readonly available: boolean;
  readonly checking: boolean;
  readonly badge: CheckBadge | null;
  readonly error: string | null;
  readonly run: () => void;
}

const CHECKING_BADGE: CheckBadge = { label: "Checking", variant: "outline", busy: true };

function sameInputs(left: Inputs, right: Inputs): boolean {
  return (
    left.platform === right.platform &&
    left.secret === right.secret &&
    left.metadata === right.metadata
  );
}

function badgeOf(result: PrecheckResult | null): CheckBadge | null {
  if (result === null) return null;
  if (result.status === "checking") return CHECKING_BADGE;
  if (result.status === "ready") return result.badge;
  return { label: "Check failed", variant: "destructive", busy: false };
}

export function useCredentialPrecheck(
  component: CredentialComponent,
  entry: CredentialPlatformEntry | null,
  secret: SecretDraft,
  metadata: MetadataDraft,
  onInvalid: (errors: DraftErrors) => void,
  onValid: () => void,
): CredentialPrecheck {
  const [precheck, setPrecheck] = useState<Precheck | null>(null);
  const inputs: Inputs = { platform: entry?.platform ?? "", secret, metadata };
  const current = precheck !== null && sameInputs(precheck.inputs, inputs) ? precheck.result : null;
  const available = entry !== null && entry.verifiable && entry.secretShape !== "oauth";

  const run = useCallback(() => {
    if (entry === null || !available || current?.status === "checking") return;
    const body = checkBodyOf(entry, secret, metadata);
    if (!body.ok) {
      onInvalid(body.errors);
      return;
    }
    onValid();
    const started: Inputs = { platform: entry.platform, secret, metadata };
    const settle = (result: PrecheckResult) =>
      setPrecheck((previous) =>
        previous !== null && !sameInputs(previous.inputs, started)
          ? previous
          : { inputs: started, result },
      );
    setPrecheck({ inputs: started, result: { status: "checking" } });
    checkCredential(component, body.value).then(
      (health) =>
        settle({
          status: "ready",
          badge: { label: healthLabel(health), variant: healthVariant(health), busy: false },
        }),
      (cause: unknown) =>
        settle({ status: "failed", message: credentialMessage(asApiError(cause)) }),
    );
  }, [component, entry, available, current, secret, metadata, onInvalid, onValid]);

  return {
    available,
    checking: current?.status === "checking",
    badge: badgeOf(current),
    error: current?.status === "failed" ? current.message : null,
    run,
  };
}
