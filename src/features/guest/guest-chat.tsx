import { useMemo } from "react";

import type { Connection } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatTranscript } from "@/features/workbench/chat/components/chat-transcript";
import { Composer } from "@/features/workbench/chat/components/composer";
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import { useScrollToEnd } from "@/features/workbench/chat/use-scroll-to-end";
import { guestItemsOf } from "@/lib/guest-chat";
import { projectRefLabel } from "@/lib/share-invite";
import { GuestQueueLine } from "./guest-queue-line";
import { GuestRunLine } from "./guest-run-line";
import { useGuestComposer } from "./use-guest-composer";
import { useGuestStream } from "./use-guest-stream";

const NO_TITLE = "Shared conversation";
const NO_NAMES: readonly string[] = [];

export function GuestChat({ connection }: { readonly connection: Connection }) {
  const { session, members, entries, state, failure } = useGuestStream(connection);
  const { composer, failure: sendFailure } = useGuestComposer(
    connection,
    session?.mention_names ?? NO_NAMES,
  );
  const items = useMemo(() => guestItemsOf(entries, state, members), [entries, state, members]);
  useScrollToEnd(items, null);
  const ended = failure?.final === true;

  if (session === null && failure?.final === true) {
    return (
      <main className="flex min-h-svh justify-center bg-muted/40 px-4 py-10">
        <Card className="h-fit w-full max-w-xl min-w-0 border border-destructive">
          <CardContent>
            <InlineError code={failure.code} message={failure.message} />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (session === null) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        {failure !== null && <ConnectionLine message={failure.message} />}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl min-w-0 flex-col gap-4 px-4 py-6">
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 text-lg font-semibold break-words">
            {session.title === null || session.title === "" ? NO_TITLE : session.title}
          </h1>
          {state !== null && (
            <Badge variant="outline">Auto mode {state.auto_mode ? "on" : "off"}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Shared by {session.owner_name} · guest view</p>
        {session.projects.length > 0 && (
          <>
            <p className="text-sm break-words text-muted-foreground">
              Projects: {session.projects.map(projectRefLabel).join(", ")}
            </p>
            <p className="text-sm text-muted-foreground">The owner approves every act.</p>
          </>
        )}
        <ul aria-label="Members" className="flex flex-wrap gap-2">
          {members.map((member) => (
            <li key={member.session_id}>
              <Badge variant="secondary">{member.display_name}</Badge>
            </li>
          ))}
        </ul>
      </header>
      <ChatTranscript
        items={items}
        authors={{ ownerName: session.owner_name }}
        runError={null}
        runLine={
          <GuestRunLine
            runActive={state?.run_active ?? session.run_active}
            waitingOperationId={state?.waiting_for_approval?.operation_id ?? null}
          />
        }
        sessionId={session.session_id}
        forkLinked={false}
      />
      {failure !== null && !ended && <ConnectionLine message={failure.message} />}
      {failure !== null && ended && <InlineError code={failure.code} message={failure.message} />}
      <div className="sticky bottom-0 bg-background pt-2">
        {state !== null && <GuestQueueLine queue={state.queue} />}
        <Composer
          composer={ended ? { ...composer, canSend: false } : composer}
          configuration={null}
          agentDisplayName=""
          runActive={false}
          queued={false}
          placeholder="Write a note"
          inputDisabled={ended}
          invalid={sendFailure !== null}
        />
        {sendFailure !== null && (
          <InlineError code={sendFailure.code} message={sendFailure.message} />
        )}
      </div>
    </main>
  );
}

function ConnectionLine({ message }: { readonly message: string }) {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      The connection to the conversation failed: {message} Trying again.
    </p>
  );
}
