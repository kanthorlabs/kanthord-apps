import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  readBindingEnvironment,
  rebuildEnvironment,
  writeBindingEnvironment,
} from "@/api/resources/projects";
import type { BindingEnvironment, EnvironmentDocument } from "@/api/types";
import { useClipboard } from "@/hooks/use-clipboard";
import { asApiError, useResource, type Resource } from "@/hooks/use-resource";
import { ENVIRONMENT_NOT_OBJECT, parseEnvironmentDocument } from "@/lib/environment-document";

export const ENVIRONMENT_RUN_ACTIVE = "project.environment.run_active";

export interface BindingEnvironmentState {
  readonly environment: Resource<BindingEnvironment>;
  readonly rebuilding: boolean;
  readonly rebuild: () => void;
  readonly copy: () => void;
  readonly copyText: (text: string, what: "tail" | "reproduce command") => void;
  readonly reload: () => void;
  readonly editing: boolean;
  readonly openEdit: () => void;
  readonly closeEdit: () => void;
  readonly initialText: string;
  readonly saving: boolean;
  readonly saveError: string | null;
  readonly save: (text: string) => void;
}

export function useBindingEnvironment(
  projectId: string,
  bindingId: string,
  bindingName: string,
  onChanged: () => void,
  onWritten: (environment: EnvironmentDocument) => void,
): BindingEnvironmentState {
  const environment = useResource(
    () => readBindingEnvironment(projectId, bindingId),
    [projectId, bindingId],
  );
  const write = useClipboard();
  const [rebuilding, setRebuilding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const rebuild = useCallback(
    function attempt() {
      setRebuilding(true);
      rebuildEnvironment(projectId, bindingId).then(
        () => {
          setRebuilding(false);
          toast.success(`Onboarding of ${bindingName} started.`);
          onChanged();
        },
        (cause: unknown) => {
          setRebuilding(false);
          const failure = asApiError(cause);
          if (failure.status === 409 && failure.detail === ENVIRONMENT_RUN_ACTIVE) {
            toast.info(`An onboarding run of ${bindingName} is active.`);
            onChanged();
            return;
          }
          toast.error(failure.message, { action: { label: "Retry", onClick: attempt } });
        },
      );
    },
    [projectId, bindingId, bindingName, onChanged],
  );

  const copyText = useCallback(
    (text: string, what: string) => {
      write(text).then(
        () => toast.success(`Copied the ${what}.`),
        () => toast.error("The browser refused the clipboard."),
      );
    },
    [write],
  );

  const { data, error, reload } = environment;

  useEffect(() => {
    if (error === null) return;
    toast.error(error.message, { action: { label: "Retry", onClick: reload } });
  }, [error, reload]);

  const copy = useCallback(() => {
    if (data === null || data.environment === null) return;
    copyText(JSON.stringify(data.environment, null, 2), `environment of ${bindingName}`);
  }, [data, bindingName, copyText]);

  const openEdit = useCallback(() => {
    setSaveError(null);
    setEditing(true);
  }, []);

  const closeEdit = useCallback(() => {
    setSaveError(null);
    setEditing(false);
  }, []);

  const save = useCallback(
    (text: string) => {
      const document = parseEnvironmentDocument(text);
      if (document === null) {
        setSaveError(ENVIRONMENT_NOT_OBJECT);
        return;
      }
      setSaving(true);
      setSaveError(null);
      writeBindingEnvironment(projectId, bindingId, document).then(
        () => {
          setSaving(false);
          reload();
          onWritten(document);
          onChanged();
          toast.success(`Saved the environment of ${bindingName}.`);
          setEditing(false);
        },
        (cause: unknown) => {
          setSaving(false);
          setSaveError(asApiError(cause).message);
        },
      );
    },
    [projectId, bindingId, bindingName, reload, onWritten, onChanged],
  );

  const initialText =
    data !== null && data.source === "stored" && data.environment !== null
      ? JSON.stringify(data.environment, null, 2)
      : "";

  return {
    environment,
    rebuilding,
    rebuild,
    copy,
    copyText,
    reload,
    editing,
    openEdit,
    closeEdit,
    initialText,
    saving,
    saveError,
    save,
  };
}
