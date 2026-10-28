import { useCallback, useState } from "react";
import { toast } from "sonner";

import { rotateCredential } from "@/api/resources/credentials";
import type {
  Credential,
  CredentialComponent,
  CredentialPlatformEntry,
  CredentialRotateBody,
} from "@/api/types";
import {
  type DraftErrors,
  EMPTY_METADATA,
  EMPTY_SECRET,
  type MetadataDraft,
  metadataDraftOf,
  rotateMetadataOf,
  type SecretDraft,
  secretOfDraft,
} from "@/lib/credential-draft";
import { newestLiveRevision } from "@/lib/credential-revisions";
import { SSH_PLATFORM } from "@/lib/ssh-key";
import { type WriteFailure, writeFailureOf } from "./write-failure";

export interface CredentialRotateState {
  readonly available: boolean;
  readonly open: boolean;
  readonly expectedRevision: number | null;
  readonly secret: SecretDraft;
  readonly metadata: MetadataDraft;
  readonly errors: DraftErrors;
  readonly failure: WriteFailure | null;
  readonly submitting: boolean;
  readonly start: () => void;
  readonly close: () => void;
  readonly readLatest: () => void;
  readonly setSecret: (secret: SecretDraft) => void;
  readonly setMetadata: (metadata: MetadataDraft) => void;
  readonly submit: () => void;
}

const NO_ERRORS: DraftErrors = {};

export function useCredentialRotate(
  component: CredentialComponent,
  credential: Credential,
  entry: CredentialPlatformEntry | null,
  reload: () => void,
): CredentialRotateState {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<SecretDraft>(EMPTY_SECRET);
  const [metadata, setMetadata] = useState<MetadataDraft>(EMPTY_METADATA);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const newest = newestLiveRevision(credential);

  const start = useCallback(() => {
    if (entry === null) return;
    setSecret(EMPTY_SECRET);
    setMetadata(metadataDraftOf(entry, newest?.metadata ?? null));
    setErrors(NO_ERRORS);
    setFailure(null);
    setOpen(true);
  }, [entry, newest]);

  const close = useCallback(() => {
    setSecret(EMPTY_SECRET);
    setOpen(false);
  }, []);

  const readLatest = useCallback(() => {
    setSecret(EMPTY_SECRET);
    setOpen(false);
    reload();
  }, [reload]);

  const submit = useCallback(() => {
    if (submitting || newest === null || entry === null) return;
    const nextSecret = secretOfDraft(entry.secret_shape, secret);
    const nextMetadata = rotateMetadataOf(entry, newest.metadata, metadata);
    if (!nextSecret.ok || !nextMetadata.ok) {
      setErrors({
        ...(nextSecret.ok ? {} : nextSecret.errors),
        ...(nextMetadata.ok ? {} : nextMetadata.errors),
      });
      return;
    }
    const body: CredentialRotateBody = {
      expected_revision: newest.revision,
      secret: nextSecret.value,
      ...(nextMetadata.value === undefined ? {} : { metadata: nextMetadata.value }),
    };
    setErrors(NO_ERRORS);
    setFailure(null);
    setSecret(EMPTY_SECRET);
    setSubmitting(true);
    rotateCredential(component, credential.name, body).then(
      (answer) => {
        setSubmitting(false);
        setOpen(false);
        toast.success(
          `Rotated ${answer.name} to revision ${newestLiveRevision(answer)?.revision ?? "?"}.`,
        );
        reload();
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(writeFailureOf(cause));
      },
    );
  }, [submitting, newest, entry, secret, metadata, component, credential, reload]);

  return {
    available:
      entry !== null &&
      credential.platform !== SSH_PLATFORM &&
      entry.secret_shape !== "ssh_key" &&
      newest !== null,
    open,
    expectedRevision: newest?.revision ?? null,
    secret,
    metadata,
    errors,
    failure,
    submitting,
    start,
    close,
    readLatest,
    setSecret,
    setMetadata,
    submit,
  };
}
