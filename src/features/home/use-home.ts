import { useCallback, useMemo, useState } from "react";

import { listWorkbenchSessions } from "@/api/resources/workbench";
import { listAgents } from "@/api/resources/workers";
import type { AgentEnablement, WorkbenchSessionListItem } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";
import { configurationOf, type ConfigurationResult, draftOf } from "@/lib/workbench-configuration";
import { type FirstSendFailure, invalidFieldsText } from "@/lib/workbench-new-session";

import { isCaseConversation } from "./case-request";

export const YUMI_AGENT = "ops@1";

export type HomeView =
  | { readonly kind: "new" }
  | {
      readonly kind: "session";
      readonly sessionId: string;
      readonly failure: FirstSendFailure | null;
    };

export interface HomeState {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly errorMessage: string | null;
  readonly retry: () => void;
  readonly enabled: boolean;
  readonly displayName: string;
  readonly configuration: ConfigurationResult;
  readonly configurationError: string | null;
  readonly view: HomeView | null;
  readonly sessionId: string | null;
  readonly newChat: () => void;
  readonly open: (sessionId: string, failure: FirstSendFailure | null) => void;
}

const NEW_VIEW: HomeView = { kind: "new" };

export function yumiConfigurationOf(enablement: AgentEnablement | null): ConfigurationResult {
  return configurationOf(draftOf(enablement));
}

function newestGeneralOf(
  items: readonly WorkbenchSessionListItem[],
): WorkbenchSessionListItem | null {
  return items
    .filter((item) => !isCaseConversation(item) && item.first_message !== "")
    .reduce<WorkbenchSessionListItem | null>(
      (newest, item) => (newest === null || item.modified > newest.modified ? item : newest),
      null,
    );
}

function pending(resource: Resource<unknown>): boolean {
  return resource.data === null && resource.error === null;
}

export function useHome(active: boolean): HomeState {
  const agents = useResource(() => (active ? listAgents() : Promise.resolve(null)), [active]);
  const yumi = agents.data?.find((agent) => agent.agentName === YUMI_AGENT) ?? null;
  const enablement = yumi?.enablement ?? null;
  const enabled = enablement?.state === "enabled";
  const sessions = useResource(
    () => (enabled ? listWorkbenchSessions(YUMI_AGENT) : Promise.resolve(null)),
    [enabled],
  );
  const [chosen, setChosen] = useState<HomeView | null>(null);

  const configuration = useMemo(() => yumiConfigurationOf(enablement), [enablement]);
  const configurationError = configuration.ok
    ? null
    : `The default configuration of Yumi holds no valid ${invalidFieldsText(configuration.errors)}.`;

  const newest = sessions.data === null ? null : newestGeneralOf(sessions.data);
  const derived: HomeView =
    newest === null ? NEW_VIEW : { kind: "session", sessionId: newest.id, failure: null };
  const view = chosen ?? derived;

  const newChat = useCallback(() => setChosen(NEW_VIEW), []);
  const open = useCallback(
    (sessionId: string, failure: FirstSendFailure | null) =>
      setChosen({ kind: "session", sessionId, failure }),
    [],
  );

  const { reload: reloadAgents } = agents;
  const { reload: reloadSessions } = sessions;
  const retry = useCallback(() => {
    reloadAgents();
    reloadSessions();
  }, [reloadAgents, reloadSessions]);

  const error = agents.error ?? sessions.error;
  const waiting = active && (pending(agents) || (enabled && pending(sessions)));
  const status = !active ? "idle" : error !== null ? "error" : waiting ? "loading" : "ready";
  const shown = status === "ready" && enabled ? view : null;

  return {
    status,
    errorMessage: error?.message ?? null,
    retry,
    enabled,
    displayName: yumi?.displayName ?? "Yumi",
    configuration,
    configurationError,
    view: shown,
    sessionId: shown?.kind === "session" ? shown.sessionId : null,
    newChat,
    open,
  };
}
