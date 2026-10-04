import { useCallback, useState } from "react";
import { toast } from "sonner";

import { updateCredentialMetadata } from "@/api/resources/credentials";
import type { Credential } from "@/api/types";
import {
  EMPTY_METADATA,
  EMPTY_MODEL,
  editMetadataOf,
  hasMetadata,
  metadataDraftOf,
  type DraftErrors,
  type MetadataDraft,
  type ModelDraft,
} from "@/lib/credential-draft";
import { newestLiveRevision } from "@/lib/credential-revisions";
import { writeFailureOf, type WriteFailure } from "./write-failure";

export interface MetadataEditState {
  readonly available: boolean;
  readonly open: boolean;
  readonly expectedRevision: number | null;
  readonly draft: MetadataDraft;
  readonly errors: DraftErrors;
  readonly failure: WriteFailure | null;
  readonly submitting: boolean;
  readonly start: () => void;
  readonly close: () => void;
  readonly readLatest: () => void;
  readonly setDraft: (draft: MetadataDraft) => void;
  readonly addModel: () => void;
  readonly editModel: (index: number, model: ModelDraft) => void;
  readonly removeModel: (index: number) => void;
  readonly submit: () => void;
}

const NO_ERRORS: DraftErrors = {};

export function useMetadataEdit(credential: Credential, reload: () => void): MetadataEditState {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MetadataDraft>(EMPTY_METADATA);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const newest = newestLiveRevision(credential);

  const start = useCallback(() => {
    setDraft(metadataDraftOf(credential.platform, newest?.metadata ?? null));
    setErrors(NO_ERRORS);
    setFailure(null);
    setOpen(true);
  }, [credential.platform, newest]);

  const close = useCallback(() => setOpen(false), []);

  const readLatest = useCallback(() => {
    setOpen(false);
    reload();
  }, [reload]);

  const addModel = useCallback(
    () => setDraft((current) => ({ ...current, models: [...current.models, EMPTY_MODEL] })),
    [],
  );

  const editModel = useCallback(
    (index: number, model: ModelDraft) =>
      setDraft((current) => ({
        ...current,
        models: current.models.map((entry, position) => (position === index ? model : entry)),
      })),
    [],
  );

  const removeModel = useCallback(
    (index: number) =>
      setDraft((current) => ({
        ...current,
        models: current.models.filter((_, position) => position !== index),
      })),
    [],
  );

  const submit = useCallback(() => {
    if (submitting || newest === null) return;
    const metadata = editMetadataOf(credential.platform, newest.metadata, draft);
    if (!metadata.ok) {
      setErrors(metadata.errors);
      return;
    }
    setErrors(NO_ERRORS);
    setFailure(null);
    setSubmitting(true);
    updateCredentialMetadata(credential.name, {
      expectedRevision: newest.revision,
      metadata: metadata.value,
    }).then(
      (answer) => {
        setSubmitting(false);
        setOpen(false);
        toast.success(
          `Saved the metadata of ${answer.name} as revision ${newestLiveRevision(answer)?.revision ?? "?"}.`,
        );
        reload();
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(writeFailureOf(cause));
      },
    );
  }, [submitting, newest, credential, draft, reload]);

  return {
    available: hasMetadata(credential.platform) && newest !== null,
    open,
    expectedRevision: newest?.revision ?? null,
    draft,
    errors,
    failure,
    submitting,
    start,
    close,
    readLatest,
    setDraft,
    addModel,
    editModel,
    removeModel,
    submit,
  };
}
