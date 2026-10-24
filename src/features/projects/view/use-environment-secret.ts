import { useCallback, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/api/errors";
import {
  createEnvironmentSecret,
  readBindingSet,
  readEnvironmentSecret,
  rotateEnvironmentSecret,
  writeBindingSet,
} from "@/api/resources/projects";
import { asApiError } from "@/hooks/use-resource";
import { newestLiveRevision } from "@/lib/credential-revisions";

export const ENVIRONMENT_SECRET_NAME = /^[A-Z_][A-Z0-9_]*$/;
export const ENVIRONMENT_SECRET_LIMIT = 16;

const CREDENTIAL_NOT_FOUND = "credential.credential.not_found";
const EMPTY_DRAFT = { variable: "", credential: "", value: "" };

export interface EnvironmentSecretDraft {
  readonly variable: string;
  readonly credential: string;
  readonly value: string;
}

export type EnvironmentSecretField = keyof EnvironmentSecretDraft;
export type EnvironmentSecretErrors = Readonly<Partial<Record<EnvironmentSecretField, string>>>;
type Secrets = Readonly<Record<string, string>>;

export interface EnvironmentSecretState {
  readonly editing: boolean;
  readonly draft: EnvironmentSecretDraft;
  readonly errors: EnvironmentSecretErrors;
  readonly sending: boolean;
  readonly sendError: string | null;
  readonly open: (variable?: string) => void;
  readonly close: () => void;
  readonly edit: (patch: Partial<EnvironmentSecretDraft>) => void;
  readonly send: () => void;
  readonly remove: (variable: string) => void;
}

function draftErrors(draft: EnvironmentSecretDraft, secrets: Secrets): EnvironmentSecretErrors {
  const errors: Partial<Record<EnvironmentSecretField, string>> = {};
  if (draft.variable === "") {
    errors.variable = "Fill Variable.";
  } else if (!ENVIRONMENT_SECRET_NAME.test(draft.variable)) {
    errors.variable =
      "A variable name uses capital letters, digits and underscores, and starts with a letter or an underscore.";
  } else if (
    !(draft.variable in secrets) &&
    Object.keys(secrets).length >= ENVIRONMENT_SECRET_LIMIT
  ) {
    errors.variable = `A binding holds at most ${ENVIRONMENT_SECRET_LIMIT} secret variables.`;
  }
  if (draft.credential.trim() === "") errors.credential = "Fill Credential.";
  if (draft.value.trim() === "") errors.value = "Fill Secret value.";
  return errors;
}

async function saveCredential(name: string, key: string): Promise<void> {
  const existing = await readEnvironmentSecret(name).catch((cause: unknown) => {
    if (
      cause instanceof ApiError &&
      cause.status === 404 &&
      cause.detail === CREDENTIAL_NOT_FOUND
    ) {
      return null;
    }
    throw cause;
  });
  if (existing === null) {
    await createEnvironmentSecret({
      name,
      platform: "environment_secret",
      metadata: null,
      secret: { key },
    });
    return;
  }
  const newest = newestLiveRevision(existing);
  if (newest === null) {
    throw new ApiError("conflict", `The credential ${name} is archived. Choose another name.`, 409);
  }
  await rotateEnvironmentSecret(name, { expected_revision: newest.revision, secret: { key } });
}

async function writeSecrets(
  projectId: string,
  bindingName: string,
  change: (current: Secrets) => Secrets,
): Promise<Secrets> {
  const set = await readBindingSet(projectId);
  const entry = set.bindings[bindingName];
  if (entry === undefined || entry.kind !== "repository") {
    throw new ApiError(
      "not_found",
      `The repository binding ${bindingName} is no longer in the binding set.`,
      404,
    );
  }
  const environment_secrets = change(entry.config.environment_secrets ?? {});
  await writeBindingSet(projectId, set.version, {
    ...set.bindings,
    [bindingName]: { kind: "repository", config: { ...entry.config, environment_secrets } },
  });
  return environment_secrets;
}

export function useEnvironmentSecret(
  projectId: string,
  bindingName: string,
  secrets: Secrets,
  onWritten: (environmentSecrets: Secrets) => void,
): EnvironmentSecretState {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EnvironmentSecretDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<EnvironmentSecretErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const open = useCallback(
    (variable?: string) => {
      const name = variable ?? "";
      setDraft({ variable: name, credential: secrets[name] ?? "", value: "" });
      setErrors({});
      setSendError(null);
      setEditing(true);
    },
    [secrets],
  );

  const close = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setSendError(null);
    setEditing(false);
  }, []);

  const edit = useCallback((patch: Partial<EnvironmentSecretDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next: Partial<Record<EnvironmentSecretField, string>> = { ...current };
      for (const field of Object.keys(patch) as EnvironmentSecretField[]) delete next[field];
      return next;
    });
  }, []);

  const send = useCallback(() => {
    if (sending) return;
    const found = draftErrors(draft, secrets);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const { variable, value } = draft;
    const credential = draft.credential.trim();
    setSending(true);
    setSendError(null);
    saveCredential(credential, value)
      .then(() =>
        writeSecrets(projectId, bindingName, (current) => ({ ...current, [variable]: credential })),
      )
      .then(
        (written) => {
          setSending(false);
          close();
          toast.success(`Set the secret ${variable} of ${bindingName}.`);
          onWritten(written);
        },
        (cause: unknown) => {
          setSending(false);
          setDraft((current) => ({ ...current, value: "" }));
          setSendError(asApiError(cause).message);
        },
      );
  }, [sending, draft, secrets, projectId, bindingName, close, onWritten]);

  const remove = useCallback(
    (variable: string) => {
      if (sending) return;
      setSending(true);
      writeSecrets(projectId, bindingName, (current) => {
        const { [variable]: _removed, ...rest } = current;
        return rest;
      }).then(
        (written) => {
          setSending(false);
          onWritten(written);
        },
        (cause: unknown) => {
          setSending(false);
          toast.error(asApiError(cause).message);
        },
      );
    },
    [sending, projectId, bindingName, onWritten],
  );

  return { editing, draft, errors, sending, sendError, open, close, edit, send, remove };
}
