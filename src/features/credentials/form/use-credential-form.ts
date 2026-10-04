import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { createCredential } from "@/api/resources/credentials";
import type { SecretShape } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import {
  CREATABLE_PLATFORMS,
  EMPTY_METADATA,
  EMPTY_SECRET,
  SECRET_SHAPES,
  createBodyOf,
  type CreatablePlatform,
  type DraftErrors,
  type MetadataDraft,
  type SecretDraft,
} from "@/lib/credential-draft";
import { credentialMessage } from "../credential-message";

export interface CredentialFormState {
  readonly name: string;
  readonly platform: CreatablePlatform;
  readonly shape: SecretShape;
  readonly secret: SecretDraft;
  readonly metadata: MetadataDraft;
  readonly errors: DraftErrors;
  readonly submitError: string | null;
  readonly submitting: boolean;
  readonly setName: (name: string) => void;
  readonly selectPlatform: (value: string | null) => void;
  readonly setSecret: (secret: SecretDraft) => void;
  readonly setMetadata: (metadata: MetadataDraft) => void;
  readonly submit: () => void;
}

const NO_ERRORS: DraftErrors = {};

export function useCredentialForm(): CredentialFormState {
  const navigate = useNavigate();
  const [name, setNameValue] = useState("");
  const [platform, setPlatform] = useState<CreatablePlatform>("github");
  const [secret, setSecret] = useState<SecretDraft>(EMPTY_SECRET);
  const [metadata, setMetadata] = useState<MetadataDraft>(EMPTY_METADATA);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setName = useCallback((next: string) => setNameValue(next), []);

  const selectPlatform = useCallback((value: string | null) => {
    const next = CREATABLE_PLATFORMS.find((candidate) => candidate === value);
    if (next === undefined) return;
    setPlatform(next);
    setSecret(EMPTY_SECRET);
    setMetadata(EMPTY_METADATA);
    setErrors(NO_ERRORS);
  }, []);

  const submit = useCallback(() => {
    if (submitting) return;
    const body = createBodyOf(name, platform, secret, metadata);
    if (!body.ok) {
      setErrors(body.errors);
      return;
    }
    setErrors(NO_ERRORS);
    setSubmitError(null);
    setSubmitting(true);
    setSecret(EMPTY_SECRET);
    createCredential(body.value).then(
      (credential) => {
        setSubmitting(false);
        toast.success(`Created ${credential.name}.`);
        void navigate(`/credentials/${encodeURIComponent(credential.name)}`);
      },
      (cause: unknown) => {
        setSubmitting(false);
        setSubmitError(credentialMessage(asApiError(cause)));
      },
    );
  }, [submitting, name, platform, secret, metadata, navigate]);

  return {
    name,
    platform,
    shape: SECRET_SHAPES[platform],
    secret,
    metadata,
    errors,
    submitError,
    submitting,
    setName,
    selectPlatform,
    setSecret,
    setMetadata,
    submit,
  };
}
