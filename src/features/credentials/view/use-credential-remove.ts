import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { removeCredential } from "@/api/resources/credentials";
import type { Credential } from "@/api/types";
import { writeFailureOf } from "../write-failure";

export interface CredentialRemoveState {
  readonly open: boolean;
  readonly consequence: string;
  readonly saferPath: string;
  readonly error: string | null;
  readonly removing: boolean;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

export function useCredentialRemove(credential: Credential): CredentialRemoveState {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const request = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const cancel = useCallback(() => {
    if (removing) return;
    setOpen(false);
    setError(null);
  }, [removing]);

  const confirm = useCallback(() => {
    if (removing) return;
    setRemoving(true);
    setError(null);
    removeCredential(credential.name).then(
      () => {
        setRemoving(false);
        toast.success(`Removed ${credential.name}. Every live revision ended.`);
        navigate("/credentials");
      },
      (cause: unknown) => {
        setRemoving(false);
        setError(writeFailureOf(cause).message);
      },
    );
  }, [removing, credential.name, navigate]);

  return {
    open,
    consequence: `Every live revision of ${credential.name} ends at once. Every execution that pins one is refused at its next use. The record and its revisions stay, because an execution record references them. A remove cannot be undone.`,
    saferPath: `Keep ${credential.name}. Rotate the secret instead when only the secret changes.`,
    error,
    removing,
    request,
    cancel,
    confirm,
  };
}
