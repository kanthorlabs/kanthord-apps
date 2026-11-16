import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import { NewSessionChat } from "@/features/workbench/chat/components/new-session-chat";
import { SessionChat } from "@/features/workbench/chat/components/session-chat";

import type { ActionCardItem } from "@/lib/workbench-chat";
import { YUMI_AGENT } from "@/lib/workbench-sessions";

import type { HomeState } from "../use-home";
import { YumiOffChat } from "./yumi-off-chat";

interface HomeChatProps {
  readonly home: HomeState;
  readonly streamEnd: ReactNode;
  readonly approvalLine: ReactNode | null;
  readonly actionLineOf: (item: ActionCardItem) => ReactNode | null;
}

export function HomeChat({ home, streamEnd, approvalLine, actionLineOf }: HomeChatProps) {
  const { view } = home;

  if (home.status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (home.status === "error") {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col items-start gap-2">
          <InlineError code={null} message={home.errorMessage ?? ""} />
          <Button variant="outline" size="sm" onClick={home.retry}>
            Retry
          </Button>
        </div>
        {streamEnd}
      </div>
    );
  }

  if (view === null) return <YumiOffChat>{streamEnd}</YumiOffChat>;

  if (view.kind === "new") {
    return (
      <NewSessionChat
        agentName={YUMI_AGENT}
        agentDisplayName={home.displayName}
        configuration={home.configuration.ok ? home.configuration.configuration : null}
        configurationError={home.configurationError}
        onOpen={home.open}
        onNew={home.newChat}
        streamEnd={streamEnd}
      />
    );
  }

  return (
    <SessionChat
      key={view.sessionId}
      sessionId={view.sessionId}
      firstSendFailure={view.failure}
      streamEnd={streamEnd}
      approvalLine={approvalLine}
      actionLineOf={actionLineOf}
      onNew={home.newChat}
    />
  );
}
