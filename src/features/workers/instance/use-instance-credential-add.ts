import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createCredential } from "@/api/resources/credentials";
import { listWorkerInstances } from "@/api/resources/worker-instances";
import type { CredentialPlatformEntry } from "@/api/types";
import { asApiError, useResource, type Resource } from "@/hooks/use-resource";
import { platformEntryOf } from "@/lib/credential-platforms";
import {
  EMPTY_METADATA,
  EMPTY_MODEL,
  EMPTY_SECRET,
  missingForCredentialCreate,
  type DraftErrors,
  type MetadataDraft,
  type ModelDraft,
  type SecretDraft,
} from "@/lib/credential-draft";
import { holderGroupsOf, instanceCopyBodyOf } from "@/lib/instance-credential-draft";
import { credentialMessage } from "@/features/credentials/credential-message";
import {
  useCredentialLogin,
  type CredentialLoginState,
} from "@/features/credentials/form/use-credential-login";
import { useCredentialPlatforms } from "@/features/credentials/use-credential-platforms";

export interface HolderGroup {
  readonly worker: string;
  readonly names: readonly string[];
}

export interface InstanceCredentialAddState {
  readonly open: boolean;
  readonly name: string;
  readonly entry: CredentialPlatformEntry | null;
  readonly platforms: readonly string[];
  readonly secret: SecretDraft;
  readonly metadata: MetadataDraft;
  readonly alsoSealTo: readonly string[];
  readonly groups: Resource<readonly HolderGroup[]>;
  readonly errors: DraftErrors;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly signIn: boolean;
  readonly login: CredentialLoginState;
  readonly missing: readonly string[];
  readonly start: () => void;
  readonly close: () => void;
  readonly setName: (name: string) => void;
  readonly selectPlatform: (platform: string | null) => void;
  readonly setSecret: (secret: SecretDraft) => void;
  readonly setMetadata: (metadata: MetadataDraft) => void;
  readonly addModel: () => void;
  readonly editModel: (index: number, model: ModelDraft) => void;
  readonly removeModel: (index: number) => void;
  readonly setAlsoSealTo: (holders: readonly string[]) => void;
  readonly submit: () => void;
}

export function useInstanceCredentialAdd(
  instanceName: string,
  reload: () => void,
): InstanceCredentialAddState {
  const [open, setOpen] = useState(false);
  const [name, setNameValue] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [secret, setSecret] = useState<SecretDraft>(EMPTY_SECRET);
  const [metadata, setMetadata] = useState<MetadataDraft>(EMPTY_METADATA);
  const [alsoSealTo, setAlsoSealTo] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const platformList = useCredentialPlatforms("llm");
  const entry = platform === null ? null : platformEntryOf(platformList.data, platform);
  const signIn = entry?.secret_shape === "oauth";
  const modes = (entry?.login_modes ?? []).filter((mode) => mode !== "browser");
  const groups = useResource(
    async () => (open ? holderGroupsOf(await listWorkerInstances(null), instanceName) : []),
    [open, instanceName],
  );

  const finish = useCallback(
    (created: string) => {
      setOpen(false);
      toast.success(`Stored ${created} for ${instanceName}.`);
      reload();
    },
    [instanceName, reload],
  );

  const login = useCredentialLogin("llm", modes, finish, instanceName, false);
  const restartLogin = login.restart;

  const start = useCallback(() => {
    setNameValue("");
    setPlatform(null);
    setSecret(EMPTY_SECRET);
    setMetadata(EMPTY_METADATA);
    setAlsoSealTo([]);
    setErrors({});
    setFailure(null);
    restartLogin();
    setOpen(true);
  }, [restartLogin]);

  const close = useCallback(() => {
    if (submitting || login.inProgress) return;
    setOpen(false);
  }, [submitting, login.inProgress]);

  const selectPlatform = useCallback((value: string | null) => {
    setPlatform(value);
    setSecret(EMPTY_SECRET);
    setMetadata(EMPTY_METADATA);
    setErrors({});
  }, []);

  const addModel = useCallback(
    () => setMetadata((current) => ({ ...current, models: [...current.models, EMPTY_MODEL] })),
    [],
  );

  const editModel = useCallback(
    (index: number, model: ModelDraft) =>
      setMetadata((current) => ({
        ...current,
        models: current.models.map((item, position) => (position === index ? model : item)),
      })),
    [],
  );

  const removeModel = useCallback(
    (index: number) =>
      setMetadata((current) => ({
        ...current,
        models: current.models.filter((_item, position) => position !== index),
      })),
    [],
  );

  const submit = useCallback(() => {
    if (submitting || entry === null) return;
    if (signIn) {
      login.start(name, entry.platform);
      return;
    }
    const body = instanceCopyBodyOf(name, entry, secret, metadata, [instanceName, ...alsoSealTo]);
    if (!body.ok) {
      setErrors(body.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setFailure(null);
    createCredential("llm", body.value).then(
      () => {
        setSubmitting(false);
        finish(name);
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(credentialMessage(asApiError(cause)));
      },
    );
  }, [submitting, entry, signIn, login, name, secret, metadata, instanceName, alsoSealTo, finish]);

  const missing =
    entry === null
      ? missingForCredentialCreate(name, null, secret, metadata)
      : signIn
        ? name.length === 0
          ? ["Name"]
          : []
        : missingForCredentialCreate(name, entry, secret, metadata);

  return {
    open,
    name,
    entry,
    platforms: (platformList.data?.items ?? []).map((item) => item.platform),
    secret,
    metadata,
    alsoSealTo,
    groups,
    errors,
    failure,
    submitting,
    signIn,
    login,
    missing,
    start,
    close,
    setName: setNameValue,
    selectPlatform,
    setSecret,
    setMetadata,
    addModel,
    editModel,
    removeModel,
    setAlsoSealTo,
    submit,
  };
}
