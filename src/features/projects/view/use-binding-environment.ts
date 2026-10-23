import { useCallback, useState } from "react";
import { toast } from "sonner";

import { readBindingEnvironment, rebuildEnvironment } from "@/api/resources/projects";
import type { BindingEnvironment } from "@/api/types";
import { useClipboard } from "@/hooks/use-clipboard";
import { asApiError, useResource, type Resource } from "@/hooks/use-resource";

export const ENVIRONMENT_RUN_ACTIVE = "project.environment.run_active";

export interface BindingEnvironmentState {
  readonly environment: Resource<BindingEnvironment>;
  readonly rebuilding: boolean;
  readonly rebuild: () => void;
  readonly copy: () => void;
  readonly copyText: (text: string, what: "tail" | "reproduce command") => void;
  readonly reload: () => void;
}

export function useBindingEnvironment(
  projectId: string,
  bindingId: string,
  bindingName: string,
  onChanged: () => void,
): BindingEnvironmentState {
  const environment = useResource(
    () => readBindingEnvironment(projectId, bindingId),
    [projectId, bindingId],
  );
  const write = useClipboard();
  const [rebuilding, setRebuilding] = useState(false);

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

  const { data, reload } = environment;
  const copy = useCallback(() => {
    if (data === null) return;
    copyText(JSON.stringify(data, null, 2), `environment of ${bindingName}`);
  }, [data, bindingName, copyText]);

  return { environment, rebuilding, rebuild, copy, copyText, reload };
}
