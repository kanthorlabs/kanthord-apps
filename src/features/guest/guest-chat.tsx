import { useMemo } from "react";

import type { Connection } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatTranscript } from "@/features/workbench/chat/components/chat-transcript";
import { Composer } from "@/features/workbench/chat/components/composer";
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import { useScrollToEnd } from "@/features/workbench/chat/use-scroll-to-end";
import { guestItemsOf, guestSnapshotOf } from "@/lib/guest-chat";
import { chatItemsOf, forkSourceIdOf } from "@/lib/workbench-chat";
import { GuestRunLine } from "./guest-run-line";
import { useGuestComposer } from "./use-guest-composer";
import { useGuestStream } from "./use-guest-stream";

const NO_TITLE = "Shared conversation";

export function GuestChat({ connection }: { readonly connection: Connection }) {
  const { session, members, entries, state, failure } = useGuestStream(connection);
  const { composer, failure: sendFailure } = useGuestComposer(connection);
  const forkedFrom = useMemo(() => forkSourceIdOf(entries), [entries]);
  const items = useMemo(
    () =>
      state === null
        ? []
        : guestItemsOf(
            chatItemsOf(entries, guestSnapshotOf(state), members, forkedFrom),
            state.display_name,
          ),
    [entries, state, members, forkedFrom],
  );
  useScrollToEnd(items, null);

  if (failure?.final === true) {
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

  if (session === null || state === null) {
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
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 text-lg font-semibold break-words">
          {session.title === "" ? NO_TITLE : session.title}
        </h1>
        <Badge variant="outline">Auto mode {state.auto_mode ? "on" : "off"}</Badge>
      </header>
      <ChatTranscript
        items={items}
        authors={{ ownerName: session.owner_name }}
        runError={null}
        runLine={<GuestRunLine runActive={state.run_active} />}
        sessionId={session.session_id}
        forkLinked={false}
      />
      {failure !== null && <ConnectionLine message={failure.message} />}
      <div className="sticky bottom-0 bg-background pt-2">
        <Composer
          composer={composer}
          configuration={null}
          agentDisplayName=""
          runActive={false}
          queued={false}
          placeholder="Write a note"
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
