import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { archiveCredential } from "@/api/resources/credentials";
import type { Credential, CredentialComponent } from "@/api/types";
import { credentialSectionPath } from "@/lib/credential-sections";
import { writeFailureOf } from "../write-failure";

export interface CredentialArchiveState {
  readonly open: boolean;
  readonly consequence: string;
  readonly saferPath: string;
  readonly error: string | null;
  readonly archiving: boolean;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

export function useCredentialArchive(
  component: CredentialComponent,
  credential: Credential,
): CredentialArchiveState {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const request = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const cancel = useCallback(() => {
    if (archiving) return;
    setOpen(false);
    setError(null);
  }, [archiving]);

  const confirm = useCallback(() => {
    if (archiving) return;
    setArchiving(true);
    setError(null);
    archiveCredential(component, credential.name).then(
      () => {
        setArchiving(false);
        toast.success(`Archived ${credential.name}. Every live revision ended.`);
        navigate(credentialSectionPath(component));
      },
      (cause: unknown) => {
        setArchiving(false);
        setError(writeFailureOf(cause).message);
      },
    );
  }, [archiving, component, credential.name, navigate]);

  return {
    open,
    consequence: `Every live revision of ${credential.name} ends at once. Every execution that pins one is refused at its next use. The record stays, because an execution record references it. An archive is final, and the name stays taken.`,
    saferPath: `Keep ${credential.name}. Rotate the secret instead when only the secret changes.`,
    error,
    archiving,
    request,
    cancel,
    confirm,
  };
}
