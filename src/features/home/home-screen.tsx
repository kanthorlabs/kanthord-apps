import { useRef } from "react";
import { Link } from "react-router-dom";

import { RefreshStatus } from "@/components/refresh-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import { queueEntryOf } from "@/lib/home-deck";

import { AbsentSourcesNote } from "./components/absent-sources-note";
import { FootprintAlert } from "./components/footprint-alert";
import { HomeChat } from "./components/home-chat";
import { HomeDeck } from "./components/home-deck";
import { HomeSkeleton } from "./components/home-skeleton";
import { QueueLine } from "./components/queue-line";
import { ReadFaultsAlert } from "./components/read-faults-alert";
import { SystemHealthAlert } from "./components/system-health-alert";
import { useHome } from "./use-home";
import { useHomeDeck } from "./use-home-deck";
import { useOverview } from "./use-overview";

interface HomeScreenProps {
  readonly onResume?: () => void;
}

export function HomeScreen({ onResume }: HomeScreenProps) {
  const overview = useOverview();
  const readFault = overview.faults.length > 0;
  const deck = useHomeDeck({
    items: overview.boardItems,
    held: overview.held,
    gates: overview.gates,
    details: overview.details,
    now: overview.now,
    status: overview.status,
    inbox: overview.inbox.open,
    readFault,
  });
  const home = useHome(overview.status === "ready");
  const deckRef = useRef<HTMLDivElement>(null);
  const queued = queueEntryOf(deck.order, home.sessionId);
  const showQueued = (itemId: string) => {
    deck.select(itemId);
    deckRef.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <h2 className="text-lg font-semibold">Home</h2>
        {onResume !== undefined && (
          <Button variant="link" size="sm" className="self-start" onClick={onResume}>
            Resume onboarding
          </Button>
        )}
        {overview.status === "ready" && (
          <div className="flex items-center gap-2 md:ml-auto">
            {home.enabled && (
              <Button variant="outline" size="sm" onClick={home.newChat}>
                New chat
              </Button>
            )}
            <RefreshStatus
              touch
              updatedAt={overview.updatedAt}
              now={overview.now}
              onRefresh={overview.refresh}
            />
          </div>
        )}
      </div>

      {overview.status === "loading" && <HomeSkeleton />}

      {overview.status === "empty" && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No projects</EmptyTitle>
            <EmptyDescription>This server holds no project.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link to="/projects/new" />} size="lg">
              New project
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {overview.status === "error" && overview.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>Home could not be read.</AlertTitle>
          <AlertDescription>{overview.error.message}</AlertDescription>
          <div className="mt-2 flex md:justify-end">
            <Button variant="outline" size="sm" onClick={overview.refresh}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {overview.status === "ready" && (
        <HomeChat
          home={home}
          approvalLine={queued === null ? null : <QueueLine entry={queued} onShow={showQueued} />}
          streamEnd={
            <>
              <SystemHealthAlert
                components={overview.unavailable}
                failure={overview.livenessFailure}
              />
              <FootprintAlert />
              {readFault && (
                <ReadFaultsAlert
                  faults={overview.faults}
                  onRetry={overview.retryFaults}
                  disabled={overview.snapshotRunning}
                />
              )}
              {overview.absent.length > 0 && <AbsentSourcesNote sources={overview.absent} />}
              <HomeDeck deck={deck} overview={overview} focusRef={deckRef} />
            </>
          }
        />
      )}
    </div>
  );
}
