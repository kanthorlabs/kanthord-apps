import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemHeader } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import { useObservations } from "./use-observations";

export function ObservationsScreen() {
  const { resource } = useObservations();
  const { data, loading, error, reload } = resource;

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertDescription>
          The observer decides the observed state and never the outcome of the node. An observation
          whose observed state is not the expected end state drives a node to External.Failed, but
          the observation itself asserts nothing about the node&#39;s success.
        </AlertDescription>
      </Alert>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error !== null && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error.message}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {!loading && error === null && data !== null && (
        <>
          {data.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No observations.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">
              {data.map((obs) => (
                <Item key={obs.id} variant="outline" role="listitem">
                  <ItemHeader className="flex-wrap justify-start">
                    <span className="font-mono text-sm font-semibold">{obs.externalObjectId}</span>
                    <span className="text-sm text-muted-foreground">
                      {relativeTime(obs.observedAt)}
                    </span>
                  </ItemHeader>
                  <ItemContent className="min-w-0">
                    <ItemDescription className="line-clamp-none">
                      Observed state: <span className="font-medium">{obs.observedState}</span>
                    </ItemDescription>
                    {obs.landedCommitIds.length > 0 && (
                      <div>
                        <p className="mb-1 text-sm text-muted-foreground">Landed commits</p>
                        <ul className="space-y-0.5">
                          {obs.landedCommitIds.map((commitId) => (
                            <li key={commitId} className="font-mono text-xs break-all">
                              {commitId}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </>
      )}
    </div>
  );
}
