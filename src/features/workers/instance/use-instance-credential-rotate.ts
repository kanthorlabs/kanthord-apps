import { useCallback, useState } from "react";
import { toast } from "sonner";

import { listAllCredentials, rotateCredential } from "@/api/resources/credentials";
import type { Credential, InstanceCredentialCopy } from "@/api/types";
import { asApiError, type Resource, useResource } from "@/hooks/use-resource";
import {
  type DraftErrors,
  EMPTY_SECRET,
  type SecretDraft,
  secretOfDraft,
} from "@/lib/credential-draft";
import { credentialMessage } from "@/features/credentials/credential-message";

export interface RotateTarget {
  readonly holder: string;
  readonly expectedRevision: number;
}

export interface InstanceCredentialRotateState {
  readonly copy: InstanceCredentialCopy | null;
  readonly secret: SecretDraft;
  readonly others: Resource<readonly RotateTarget[]>;
  readonly alsoRotateOn: readonly string[];
  readonly errors: DraftErrors;
  readonly outcome: readonly string[];
  readonly submitting: boolean;
  readonly start: (copy: InstanceCredentialCopy) => void;
  readonly close: () => void;
  readonly setSecret: (secret: SecretDraft) => void;
  readonly setAlsoRotateOn: (holders: readonly string[]) => void;
  readonly submit: () => void;
}

function liveRevisionOf(credential: Credential): number | null {
  const live = credential.revisions.filter((revision) => revision.ended_at === null);
  return live.length === 0 ? null : Math.max(...live.map((revision) => revision.revision));
}

export function rotateTargetsOf(
  rows: readonly Credential[],
  name: string,
  holder: string,
): readonly RotateTarget[] {
  return rows.flatMap((row) => {
    const revision = liveRevisionOf(row);
    if (row.name !== name || row.holder === holder || revision === null) return [];
    return [{ holder: row.holder, expectedRevision: revision }];
  });
}

export function useInstanceCredentialRotate(
  instanceName: string,
  reload: () => void,
): InstanceCredentialRotateState {
  const [copy, setCopy] = useState<InstanceCredentialCopy | null>(null);
  const [secret, setSecret] = useState<SecretDraft>(EMPTY_SECRET);
  const [alsoRotateOn, setAlsoRotateOn] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [outcome, setOutcome] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const others = useResource(
    async () =>
      copy === null
        ? []
        : rotateTargetsOf(await listAllCredentials("llm"), copy.name, instanceName),
    [copy?.name, instanceName],
  );

  const start = useCallback((next: InstanceCredentialCopy) => {
    setCopy(next);
    setSecret(EMPTY_SECRET);
    setAlsoRotateOn([]);
    setErrors({});
    setOutcome([]);
  }, []);

  const close = useCallback(() => {
    if (!submitting) setCopy(null);
  }, [submitting]);

  const submit = useCallback(() => {
    if (submitting || copy === null) return;
    const parsed = secretOfDraft("api_key", secret);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    const targets: readonly RotateTarget[] = [
      { holder: instanceName, expectedRevision: copy.revision },
      ...(others.data ?? []).filter((target) => alsoRotateOn.includes(target.holder)),
    ];
    setErrors({});
    setSubmitting(true);
    void Promise.allSettled(
      targets.map((target) =>
        rotateCredential(
          "llm",
          copy.name,
          { expected_revision: target.expectedRevision, secret: parsed.value },
          target.holder,
        ),
      ),
    ).then((results) => {
      setSubmitting(false);
      const lines = results.map((result, index) => {
        const holder = targets[index]?.holder ?? "";
        return result.status === "fulfilled"
          ? `${holder}: rotated.`
          : `${holder}: not rotated. ${credentialMessage(asApiError(result.reason))}`;
      });
      reload();
      if (results.every((result) => result.status === "fulfilled")) {
        toast.success(
          `Rotated ${copy.name} on ${targets.map((target) => target.holder).join(", ")}.`,
        );
        setCopy(null);
        return;
      }
      setOutcome(lines);
    });
  }, [submitting, copy, secret, instanceName, others.data, alsoRotateOn, reload]);

  return {
    copy,
    secret,
    others,
    alsoRotateOn,
    errors,
    outcome,
    submitting,
    start,
    close,
    setSecret,
    setAlsoRotateOn,
    submit,
  };
}
