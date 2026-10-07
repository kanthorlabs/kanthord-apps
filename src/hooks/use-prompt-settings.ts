import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  readPromptSettings,
  setSystemLayerOverride,
  switchPromptSource,
} from "@/api/resources/prompts";
import type { PromptSettings, PromptTarget, SystemLayerOverride } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";

export interface PromptSettingsState {
  readonly settings: PromptSettings | null;
  readonly failure: string | null;
  readonly pending: boolean;
  readonly switchSource: (name: string, enabled: boolean, title: string) => void;
  readonly setOverride: (value: SystemLayerOverride) => void;
}

export function usePromptSettings(
  target: PromptTarget,
  onChanged: () => void,
): PromptSettingsState {
  const { scope, agentName } = target;
  const resource = useResource(
    () => readPromptSettings({ scope, ...(agentName === undefined ? {} : { agentName }) }),
    [scope, agentName],
  );
  const [pending, setPending] = useState(false);
  const settings = resource.data;
  const reload = resource.reload;

  const write = useCallback(
    (run: (current: PromptSettings) => Promise<PromptSettings>, done: string) => {
      if (settings === null || pending) return;
      setPending(true);
      run(settings).then(
        () => {
          setPending(false);
          toast.success(done);
          reload();
          onChanged();
        },
        (cause: unknown) => {
          setPending(false);
          const error = asApiError(cause);
          toast.error(
            error.code === "conflict"
              ? "The prompt settings changed elsewhere. The page shows the current state."
              : error.message,
          );
          reload();
          onChanged();
        },
      );
    },
    [settings, pending, reload, onChanged],
  );

  const switchSource = useCallback(
    (name: string, enabled: boolean, title: string) =>
      write(
        (current) =>
          switchPromptSource(
            { scope, ...(agentName === undefined ? {} : { agentName }) },
            current.revision,
            name,
            enabled,
          ),
        `Turned ${title} ${enabled ? "on" : "off"}.`,
      ),
    [write, scope, agentName],
  );

  const setOverride = useCallback(
    (value: SystemLayerOverride) => {
      if (agentName === undefined) return;
      write(
        (current) => setSystemLayerOverride(agentName, current.revision, value),
        `Set the system layer of ${agentName} to ${value}.`,
      );
    },
    [write, agentName],
  );

  return {
    settings,
    failure: resource.error?.message ?? null,
    pending,
    switchSource,
    setOverride,
  };
}
