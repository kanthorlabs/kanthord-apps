import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  putPromptText,
  readPromptSettings,
  setSystemLayerOverride,
  switchPromptSource,
} from "@/api/resources/prompts";
import type { PromptSettings, PromptTarget, SystemLayerOverride } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import type { PromptSaveResult } from "@/lib/prompt-text";

export interface PromptSettingsState {
  readonly settings: PromptSettings | null;
  readonly failure: string | null;
  readonly pending: boolean;
  readonly switchSource: (name: string, enabled: boolean, title: string) => void;
  readonly setOverride: (value: SystemLayerOverride) => void;
  readonly saveText: (text: string) => Promise<PromptSaveResult>;
  readonly reload: () => void;
}

export function usePromptSettings(
  target: PromptTarget,
  onChanged: () => void,
): PromptSettingsState {
  const { scope, agent_name: agentName } = target;
  const resource = useResource(
    () =>
      readPromptSettings({ scope, ...(agentName === undefined ? {} : { agent_name: agentName }) }),
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
            { scope, ...(agentName === undefined ? {} : { agent_name: agentName }) },
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

  const saveText = useCallback(
    (text: string): Promise<PromptSaveResult> => {
      if (settings === null) return Promise.resolve({ ok: false, message: "", conflict: false });
      return putPromptText(
        { scope, ...(agentName === undefined ? {} : { agent_name: agentName }) },
        settings.revision,
        text,
      ).then(
        (): PromptSaveResult => {
          toast.success("Saved the custom prompt.");
          reload();
          onChanged();
          return { ok: true };
        },
        (cause: unknown): PromptSaveResult => {
          const error = asApiError(cause);
          return { ok: false, message: error.message, conflict: error.code === "conflict" };
        },
      );
    },
    [settings, scope, agentName, reload, onChanged],
  );

  return {
    settings,
    failure: resource.error?.message ?? null,
    pending,
    switchSource,
    setOverride,
    saveText,
    reload,
  };
}
