import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createSshKey } from "@/api/resources/credentials";
import type { SshMetadata } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { credentialNameError } from "@/lib/credential-draft";
import { newestSshKeyOf } from "@/lib/ssh-key";
import { credentialMessage } from "./credential-message";

export interface CreatedSshKey {
  readonly name: string;
  readonly key: SshMetadata | null;
}

export interface SshKeyCreateState {
  readonly name: string;
  readonly nameError: string | undefined;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly created: CreatedSshKey | null;
  readonly setName: (name: string) => void;
  readonly submit: () => void;
}

export function useSshKeyCreate(): SshKeyCreateState {
  const [name, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedSshKey | null>(null);

  const setName = useCallback((value: string) => {
    setNameValue(value);
    setNameError(undefined);
    setFailure(null);
  }, []);

  const submit = useCallback(() => {
    if (submitting || created !== null) return;
    const trimmed = name.trim();
    const error = credentialNameError(trimmed);
    if (error !== null) {
      setNameError(error);
      return;
    }
    setSubmitting(true);
    setFailure(null);
    createSshKey({ name: trimmed }).then(
      (credential) => {
        setSubmitting(false);
        setCreated({ name: credential.name, key: newestSshKeyOf(credential) });
        toast.success(`Created ${credential.name}.`);
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(credentialMessage(asApiError(cause)));
      },
    );
  }, [submitting, created, name]);

  return { name, nameError, failure, submitting, created, setName, submit };
}
