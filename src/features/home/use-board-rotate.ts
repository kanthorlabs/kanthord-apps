import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { listAllCredentials, rotateCredential } from "@/api/resources/credentials";
import { credentialMessage } from "@/features/credentials/credential-message";
import { useCredentialPlatforms } from "@/features/credentials/use-credential-platforms";
import { type WriteFailure, writeFailureOf } from "@/features/credentials/write-failure";
import {
  type RotateTarget,
  rotateTargetsOf,
} from "@/features/workers/instance/use-instance-credential-rotate";
import type { Credential, SecretShape } from "@/api/types";
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
  readonly revision: number | null;
  readonly loading: boolean;
  readonly shape: SecretShape | null;
  readonly keptHolders: readonly string[];
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

export interface RotatedCopies {
  readonly revision: number;
  readonly holders: readonly string[];
  readonly server: boolean;
}

export interface NamedRotateOptions {
  readonly reload: () => void;
  readonly onActed: (rotated: RotatedCopies) => void;
  readonly onOpenChange: (open: boolean) => void;
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

function rotatedOf(
  targets: readonly RotateTarget[],
  results: readonly PromiseSettledResult<Credential>[],
): RotatedCopies | null {
  const revision = revisionOf(results);
  if (revision === null) return null;
  const holders = targets.flatMap((target, index) =>
    target.holder !== SERVER && results[index]?.status === "fulfilled" ? [target.holder] : [],
  );
  return { revision: revision.revision, holders, server: results[0]?.status === "fulfilled" };
}

export function useNamedRotate(
  name: string,
  { reload, onActed, onOpenChange }: NamedRotateOptions,
): BoardRotate {
  const rows = useResource(() => listAllCredentials("llm"), [name]);
  const { reload: reloadRows } = rows;
  const platforms = useCredentialPlatforms("llm");
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<SecretDraft>(EMPTY_SECRET);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [checked, setChecked] = useState<readonly string[]>(NO_HOLDERS);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [outcome, setOutcome] = useState<readonly string[]>(NO_LINES);
  const [acted, setActed] = useState<RotatedCopies | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const copy = rows.data?.find((row) => row.name === name && row.holder === SERVER) ?? null;
  const serverRevision = copy === null ? null : (newestLiveRevision(copy)?.revision ?? null);
  const entry =
    platforms.data?.items.find((platform) => platform.platform === copy?.platform) ?? null;
  const oauth = entry?.secret_shape === "oauth";
  const holders = useMemo(
    () => (rows.data === null ? [] : rotateTargetsOf(rows.data, name, SERVER)),
    [rows.data, name],
  );
  const others = useMemo(() => (oauth ? [] : holders), [oauth, holders]);
  const missing =
    rows.data === null
      ? "the credential read"
      : serverRevision === null
        ? `a server copy of ${name}`
        : entry === null
          ? "the platform read"
          : null;

  useEffect(() => {
    if (!open) return undefined;
    onOpenChange(true);
    return () => onOpenChange(false);
  }, [open, onOpenChange]);

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
    (rotated: RotatedCopies | null) => {
      setSecret(EMPTY_SECRET);
      setOpen(false);
      if (rotated === null) return;
      onActed(rotated);
      reload();
    },
    [onActed, reload],
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
    if (submitting || serverRevision === null || entry === null) return;
    const parsed = secretOfDraft(entry.secret_shape, secret);
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
      const rotated = rotatedOf(targets, results);
      setActed(rotated);
      if (lost.length === 0) {
        toast.success(`Rotated ${name} to revision ${revisionOf(results)?.revision ?? "?"}.`);
        leave(rotated);
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
  }, [submitting, serverRevision, entry, secret, others, checked, name, leave]);

  return {
    name,
    missing,
    revision: serverRevision,
    loading: rows.loading || platforms.loading,
    shape: entry?.secret_shape ?? null,
    keptHolders: oauth ? holders.map((target) => target.holder) : NO_HOLDERS,
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

export function useBoardRotate(
  item: CredentialRefusedItem,
  { reload, paused, markActed, setDialogOpen }: RotateContext,
): BoardRotate {
  const nodeId = item.nodeIds[0] ?? item.id;
  const onActed = useCallback(
    (rotated: RotatedCopies) =>
      markActed(item.id, {
        id: "rotate",
        revision: rotated.revision,
        holders: rotated.holders,
        paused,
      }),
    [markActed, item.id, paused],
  );
  const onOpenChange = useCallback(
    (open: boolean) => setDialogOpen(item.id, nodeId, open),
    [setDialogOpen, item.id, nodeId],
  );
  return useNamedRotate(item.credential, { reload, onActed, onOpenChange });
}
