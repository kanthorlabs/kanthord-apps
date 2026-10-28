import { useCallback, useState } from "react";
import { toast } from "sonner";

import { readCredential, rotateSshKey } from "@/api/resources/credentials";
import type { Credential, CredentialBinding, SshMetadata } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { newestLiveRevision } from "@/lib/credential-revisions";
import { newestSshKeyOf, SSH_PLATFORM } from "@/lib/ssh-key";
import { credentialMessage } from "./credential-message";
import { type WriteFailure, writeFailureOf } from "./write-failure";

export type SshKeyBindings =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly items: readonly CredentialBinding[] }
  | { readonly status: "error"; readonly message: string };

export interface RotatedSshKey {
  readonly revision: number;
  readonly key: SshMetadata | null;
}

export interface SshKeyRotateState {
  readonly available: boolean;
  readonly open: boolean;
  readonly expectedRevision: number | null;
  readonly bindings: SshKeyBindings;
  readonly failure: WriteFailure | null;
  readonly submitting: boolean;
  readonly rotated: RotatedSshKey | null;
  readonly start: () => void;
  readonly close: () => void;
  readonly readBindings: () => void;
  readonly readLatest: () => void;
  readonly confirm: () => void;
}

const LOADING: SshKeyBindings = { status: "loading" };

export function useSshKeyRotate(credential: Credential, reload: () => void): SshKeyRotateState {
  const [open, setOpen] = useState(false);
  const [bindings, setBindings] = useState<SshKeyBindings>(LOADING);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rotated, setRotated] = useState<RotatedSshKey | null>(null);
  const newest = newestLiveRevision(credential);
  const name = credential.name;

  const readBindings = useCallback(() => {
    setBindings(LOADING);
    readCredential("repository", name).then(
      (answer) => setBindings({ status: "ready", items: answer.bindings }),
      (cause: unknown) =>
        setBindings({ status: "error", message: credentialMessage(asApiError(cause)) }),
    );
  }, [name]);

  const start = useCallback(() => {
    setFailure(null);
    setRotated(null);
    setOpen(true);
    readBindings();
  }, [readBindings]);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    if (rotated !== null) reload();
  }, [submitting, rotated, reload]);

  const readLatest = useCallback(() => {
    setOpen(false);
    reload();
  }, [reload]);

  const confirm = useCallback(() => {
    if (submitting || rotated !== null || newest === null) return;
    setSubmitting(true);
    setFailure(null);
    rotateSshKey(name, { expected_revision: newest.revision }).then(
      (answer) => {
        setSubmitting(false);
        const revision = newestLiveRevision(answer)?.revision ?? newest.revision + 1;
        setRotated({ revision, key: newestSshKeyOf(answer) });
        toast.success(`Rotated the key of ${answer.name} to revision ${revision}.`);
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(writeFailureOf(cause));
      },
    );
  }, [submitting, rotated, newest, name]);

  return {
    available: credential.platform === SSH_PLATFORM && newest !== null,
    open,
    expectedRevision: newest?.revision ?? null,
    bindings,
    failure,
    submitting,
    rotated,
    start,
    close,
    readBindings,
    readLatest,
    confirm,
  };
}
