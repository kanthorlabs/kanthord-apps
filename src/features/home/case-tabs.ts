import { createWorkbenchSession, sendWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchConfiguration } from "@/api/types";
import { basePath } from "@/components/base-path";
import { asApiError } from "@/hooks/use-resource";
import { workbenchSessionPath } from "@/lib/workbench-sessions";

import { YUMI_AGENT } from "./use-home";

export interface CaseTab {
  tab: Window;
  readonly sessionId: string;
  sent: boolean;
}

export interface CaseToasts {
  readonly blocked: () => void;
  readonly missingConfiguration: () => void;
  readonly createFailed: (message: string) => void;
  readonly unsent: (retry: () => void) => void;
}

export interface CaseAsk {
  readonly key: string;
  readonly request: string;
  readonly configuration: WorkbenchConfiguration | null;
  readonly toasts: CaseToasts;
}

export interface CaseTabs {
  readonly tabs: ReadonlyMap<string, CaseTab>;
  readonly askYumi: (ask: CaseAsk) => void;
}

function conversationUrlOf(sessionId: string): string {
  return `${basePath().replace(/\/+$/, "")}${workbenchSessionPath(sessionId)}`;
}

export function createCaseTabs(): CaseTabs {
  const tabs = new Map<string, CaseTab>();
  const inFlight = new Set<string>();

  async function send(entry: CaseTab, ask: CaseAsk): Promise<void> {
    try {
      await sendWorkbenchMessage(entry.sessionId, ask.request);
    } catch {
      ask.toasts.unsent(() => void deliver(ask));
      return;
    }
    entry.sent = true;
    entry.tab.location.replace(conversationUrlOf(entry.sessionId));
  }

  async function deliver(ask: CaseAsk): Promise<void> {
    const entry = tabs.get(ask.key);
    if (entry === undefined || entry.sent || inFlight.has(ask.key)) return;
    inFlight.add(ask.key);
    try {
      await send(entry, ask);
    } finally {
      inFlight.delete(ask.key);
    }
  }

  async function begin(tab: Window, ask: CaseAsk, configuration: WorkbenchConfiguration) {
    inFlight.add(ask.key);
    try {
      let sessionId: string;
      try {
        sessionId = (await createWorkbenchSession({ agent_name: YUMI_AGENT, ...configuration })).id;
      } catch (cause) {
        tab.close();
        ask.toasts.createFailed(asApiError(cause).message);
        return;
      }
      const entry: CaseTab = { tab, sessionId, sent: false };
      tabs.set(ask.key, entry);
      await send(entry, ask);
    } finally {
      inFlight.delete(ask.key);
    }
  }

  function reopen(entry: CaseTab, ask: CaseAsk): void {
    const wasClosed = entry.tab.closed;
    const answer = window.open("", `kanthord-case-${ask.key}`);
    if (answer === null) {
      ask.toasts.blocked();
      return;
    }
    if (wasClosed) answer.location.replace(conversationUrlOf(entry.sessionId));
    answer.focus();
    entry.tab = answer;
    void deliver(ask);
  }

  function askYumi(ask: CaseAsk): void {
    const entry = tabs.get(ask.key);
    if (entry !== undefined) {
      reopen(entry, ask);
      return;
    }
    const tab = window.open("", `kanthord-case-${ask.key}`);
    if (tab === null) {
      ask.toasts.blocked();
      return;
    }
    if (inFlight.has(ask.key)) {
      tab.focus();
      return;
    }
    if (ask.configuration === null) {
      tab.close();
      ask.toasts.missingConfiguration();
      return;
    }
    void begin(tab, ask, ask.configuration);
  }

  return { tabs, askYumi };
}
