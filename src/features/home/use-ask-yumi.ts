import { useCallback } from "react";
import { toast } from "sonner";

import type { AttentionItem } from "@/lib/attention";

import { caseRequestOf } from "./case-request";
import { type CaseToasts, createCaseTabs } from "./case-tabs";
import type { HomeState } from "./use-home";

const PAGE_TABS = createCaseTabs();

const TOASTS: CaseToasts = {
  blocked: () => toast.error("The browser blocked the case tab."),
  missingConfiguration: () => toast.error("Yumi has no default configuration."),
  createFailed: (message) =>
    toast.error("The case conversation could not start.", { description: message }),
  unsent: (message, retry) =>
    toast.error("The case request was not sent.", {
      description: message,
      action: { label: "Retry", onClick: retry },
    }),
};

export type AskYumiFor = (item: AttentionItem) => (() => void) | null;

export function useAskYumi(home: Pick<HomeState, "enabled" | "configuration">): AskYumiFor {
  const { enabled, configuration } = home;
  const defaultConfiguration = configuration.ok ? configuration.configuration : null;

  return useCallback(
    (item) => {
      const request = caseRequestOf(item);
      if (!enabled || request === null) return null;
      return () =>
        PAGE_TABS.askYumi({
          key: item.id,
          request,
          configuration: defaultConfiguration,
          toasts: TOASTS,
        });
    },
    [enabled, defaultConfiguration],
  );
}
