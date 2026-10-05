import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { createCredential } from "@/api/resources/credentials";
import type {
  CredentialComponent,
  CredentialLoginMode,
  CredentialPlatform,
  CredentialPlatformEntry,
  CredentialPlatformList,
} from "@/api/types";
import { asApiError, type Resource } from "@/hooks/use-resource";
import {
  EMPTY_METADATA,
  EMPTY_SECRET,
  createBodyOf,
  credentialNameError,
  type DraftErrors,
  type MetadataDraft,
  type SecretDraft,
} from "@/lib/credential-draft";
import { platformEntryOf, platformIdsOf } from "@/lib/credential-platforms";
import { credentialDetailPath } from "@/lib/credential-sections";
import { credentialMessage } from "../credential-message";
import { useCredentialPlatforms } from "../use-credential-platforms";
import { useCredentialLogin, type CredentialLoginState } from "./use-credential-login";

export interface CredentialFormState {
  readonly name: string;
  readonly platforms: Resource<CredentialPlatformList>;
  readonly platformIds: readonly CredentialPlatform[];
  readonly platform: CredentialPlatform;
  readonly entry: CredentialPlatformEntry | null;
  readonly oauth: boolean;
  readonly secret: SecretDraft;
  readonly metadata: MetadataDraft;
  readonly errors: DraftErrors;
  readonly submitError: string | null;
  readonly submitting: boolean;
  readonly login: CredentialLoginState;
  readonly setName: (name: string) => void;
  readonly selectPlatform: (value: string | null) => void;
  readonly setSecret: (secret: SecretDraft) => void;
  readonly setMetadata: (metadata: MetadataDraft) => void;
  readonly submit: () => void;
}

const NO_ERRORS: DraftErrors = {};
const NO_LOGIN_MODES: readonly CredentialLoginMode[] = [];

export function useCredentialForm(component: CredentialComponent): CredentialFormState {
  const navigate = useNavigate();
  const [name, setNameValue] = useState("");
  const platforms = useCredentialPlatforms(component);
  const [selected, setPlatform] = useState<CredentialPlatform | null>(null);
  const platform = selected ?? platforms.data?.items[0]?.platform ?? "";
  const entry = platformEntryOf(platforms.data, platform);
  const login = useCredentialLogin(component, entry?.loginModes ?? NO_LOGIN_MODES);
  const [secret, setSecret] = useState<SecretDraft>(EMPTY_SECRET);
  const [metadata, setMetadata] = useState<MetadataDraft>(EMPTY_METADATA);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const oauth = entry?.secretShape === "oauth";
  const { start: startLogin, clearStartError } = login;

  const setName = useCallback((next: string) => setNameValue(next), []);

  const selectPlatform = useCallback(
    (value: string | null) => {
      const next = platformEntryOf(platforms.data, value);
      if (next === null) return;
      setPlatform(next.platform);
      setSecret(EMPTY_SECRET);
      setMetadata(EMPTY_METADATA);
      setErrors(NO_ERRORS);
      setSubmitError(null);
      clearStartError();
    },
    [platforms.data, clearStartError],
  );

  const submitLogin = useCallback(() => {
    const invalid = credentialNameError(name);
    setErrors(invalid === null ? NO_ERRORS : { name: invalid });
    if (invalid === null) startLogin(name, platform);
  }, [name, platform, startLogin]);

  const submitCreate = useCallback(() => {
    if (entry === null) return;
    const body = createBodyOf(name, entry, secret, metadata);
    if (!body.ok) {
      setErrors(body.errors);
      return;
    }
    setErrors(NO_ERRORS);
    setSubmitError(null);
    setSubmitting(true);
    setSecret(EMPTY_SECRET);
    createCredential(component, body.value).then(
      (credential) => {
        setSubmitting(false);
        toast.success(`Created ${credential.name}.`);
        void navigate(credentialDetailPath(component, credential.name));
      },
      (cause: unknown) => {
        setSubmitting(false);
        setSubmitError(credentialMessage(asApiError(cause)));
      },
    );
  }, [component, name, entry, secret, metadata, navigate]);

  const submit = useCallback(() => {
    if (submitting || login.starting) return;
    if (oauth) submitLogin();
    else submitCreate();
  }, [submitting, login.starting, oauth, submitLogin, submitCreate]);

  return {
    name,
    platforms,
    platformIds: platformIdsOf(platforms.data),
    platform,
    entry,
    oauth,
    secret,
    metadata,
    errors,
    submitError: oauth ? login.startError : submitError,
    submitting: submitting || login.starting,
    login,
    setName,
    selectPlatform,
    setSecret,
    setMetadata,
    submit,
  };
}
