import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
            <p className="text-sm text-muted-foreground">No observations.</p>
          ) : (
            <div className="grid gap-3">
              {data.map((obs) => (
                <Card key={obs.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-mono text-sm font-semibold">
                        {obs.externalObjectId}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {relativeTime(obs.observedAt)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Observed state: </span>
                      <span className="font-medium">{obs.observedState}</span>
                    </p>
                    {obs.landedCommitIds.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Landed commits</p>
                        <ul className="space-y-0.5">
                          {obs.landedCommitIds.map((commitId) => (
                            <li key={commitId} className="font-mono text-xs">
                              {commitId}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
