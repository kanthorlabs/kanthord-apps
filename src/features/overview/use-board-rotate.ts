import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { listAllCredentials, rotateCredential } from "@/api/resources/credentials";
import { credentialMessage } from "@/features/credentials/credential-message";
import { type WriteFailure, writeFailureOf } from "@/features/credentials/write-failure";
import {
  type RotateTarget,
  rotateTargetsOf,
} from "@/features/workers/instance/use-instance-credential-rotate";
import type { Credential } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import {
  type DraftErrors,
  EMPTY_SECRET,
  type SecretDraft,
  secretOfDraft,
} from "@/lib/credential-draft";
import { newestLiveRevision } from "@/lib/credential-revisions";
import type { ActedAct } from "@/lib/board-done";
import type { CredentialRefusedItem } from "@/lib/fix-attention";

export interface BoardRotate {
  readonly name: string;
  readonly missing: string | null;
  readonly open: boolean;
  readonly secret: SecretDraft;
  readonly errors: DraftErrors;
  readonly choices: readonly string[];
  readonly chosen: readonly string[];
  readonly failure: WriteFailure | null;
  readonly outcome: readonly string[];
  readonly submitting: boolean;
  readonly start: () => void;
  readonly close: () => void;
  readonly readLatest: () => void;
  readonly setSecret: (secret: SecretDraft) => void;
  readonly choose: (labels: readonly string[]) => void;
  readonly submit: () => void;
}

interface RotateContext {
  readonly reload: () => void;
  readonly paused: number;
  readonly markActed: (itemId: string, act?: ActedAct) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean) => void;
}

const SERVER = "server";
const NO_ERRORS: DraftErrors = {};
const NO_LINES: readonly string[] = [];
const NO_HOLDERS: readonly string[] = [];

function labelOf(target: RotateTarget): string {
  return `${target.holder} (v${target.expectedRevision})`;
}

function revisionOf(results: readonly PromiseSettledResult<Credential>[]) {
  const first = results.find((result) => result.status === "fulfilled");
  return first === undefined ? null : newestLiveRevision(first.value);
}

function rotatedActOf(
  targets: readonly RotateTarget[],
  results: readonly PromiseSettledResult<Credential>[],
  paused: number,
): ActedAct | null {
  const revision = revisionOf(results);
  if (revision === null) return null;
  const holders = targets.flatMap((target, index) =>
    target.holder !== SERVER && results[index]?.status === "fulfilled" ? [target.holder] : [],
  );
  return { id: "rotate", revision: revision.revision, holders, paused };
}

export function useBoardRotate(
  item: CredentialRefusedItem,
  { reload, paused, markActed, setDialogOpen }: RotateContext,
): BoardRotate {
  const name = item.credential;
  const itemId = item.id;
  const nodeId = item.nodeIds[0] ?? itemId;
  const rows = useResource(() => listAllCredentials("llm"), [name]);
  const { reload: reloadRows } = rows;
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<SecretDraft>(EMPTY_SECRET);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [checked, setChecked] = useState<readonly string[]>(NO_HOLDERS);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [outcome, setOutcome] = useState<readonly string[]>(NO_LINES);
  const [acted, setActed] = useState<ActedAct | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const copy = rows.data?.find((row) => row.name === name && row.holder === SERVER) ?? null;
  const serverRevision = copy === null ? null : (newestLiveRevision(copy)?.revision ?? null);
  const others = useMemo(
    () => (rows.data === null ? [] : rotateTargetsOf(rows.data, name, SERVER)),
    [rows.data, name],
  );
  const missing =
    rows.data === null
      ? "the credential read"
      : serverRevision === null
        ? `a server copy of ${name}`
        : null;

  useEffect(() => {
    if (!open) return undefined;
    setDialogOpen(itemId, nodeId, true);
    return () => setDialogOpen(itemId, nodeId, false);
  }, [itemId, nodeId, open, setDialogOpen]);

  const start = useCallback(() => {
    if (missing !== null) return;
    setSecret(EMPTY_SECRET);
    setErrors(NO_ERRORS);
    setChecked(NO_HOLDERS);
    setFailure(null);
    setOutcome(NO_LINES);
    setActed(null);
    setOpen(true);
  }, [missing]);

  const leave = useCallback(
    (act: ActedAct | null) => {
      setSecret(EMPTY_SECRET);
      setOpen(false);
      if (act === null) return;
      markActed(itemId, act);
      reload();
    },
    [markActed, itemId, reload],
  );

  const close = useCallback(() => {
    if (!submitting) leave(acted);
  }, [submitting, leave, acted]);

  const readLatest = useCallback(() => {
    reloadRows();
    leave(null);
    reload();
  }, [reloadRows, leave, reload]);

  const choose = useCallback(
    (labels: readonly string[]) => {
      setChecked(
        others.filter((target) => labels.includes(labelOf(target))).map((target) => target.holder),
      );
    },
    [others],
  );

  const submit = useCallback(() => {
    if (submitting || serverRevision === null) return;
    const parsed = secretOfDraft("api_key", secret);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    const targets: readonly RotateTarget[] = [
      { holder: SERVER, expectedRevision: serverRevision },
      ...others.filter((target) => checked.includes(target.holder)),
    ];
    setErrors(NO_ERRORS);
    setFailure(null);
    setOutcome(NO_LINES);
    setSubmitting(true);
    void Promise.allSettled(
      targets.map((target) =>
        rotateCredential(
          "llm",
          name,
          { expected_revision: target.expectedRevision, secret: parsed.value },
          target.holder,
        ),
      ),
    ).then((results) => {
      setSubmitting(false);
      const lost = results.flatMap((result, index) =>
        result.status === "rejected"
          ? [{ holder: targets[index]?.holder ?? "", cause: result.reason as unknown }]
          : [],
      );
      const act = rotatedActOf(targets, results, paused);
      setActed(act);
      if (lost.length === 0) {
        toast.success(`Rotated ${name} to revision ${revisionOf(results)?.revision ?? "?"}.`);
        leave(act);
        return;
      }
      if (targets.length === 1) {
        setFailure(writeFailureOf(lost[0]?.cause));
        return;
      }
      setOutcome(
        lost.map(
          ({ holder, cause }) => `${holder}: not rotated. ${credentialMessage(asApiError(cause))}`,
        ),
      );
    });
  }, [submitting, serverRevision, secret, others, checked, name, paused, leave]);

  return {
    name,
    missing,
    open,
    secret,
    errors,
    choices: others.map(labelOf),
    chosen: others.filter((target) => checked.includes(target.holder)).map(labelOf),
    failure,
    outcome,
    submitting,
    start,
    close,
    readLatest,
    setSecret,
    choose,
    submit,
  };
}
