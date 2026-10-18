import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { utcDateTime } from "@/lib/format";
import type { ActivityRead, NodeClaimant } from "../use-node-claimant";
import { FactList } from "./fact-list";

function ActivityValue({ read }: { read: ActivityRead }) {
  if (read.state === "loading") return "Reading the instance.";
  if (read.state === "gone") return "not registered";
  if (read.state === "found") return read.activity;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>The instance could not be read: {read.message}</span>
      <Button variant="outline" size="sm" onClick={read.retry}>
        Retry
      </Button>
    </span>
  );
}

export function NodeClaimantFacts({ claimant }: { claimant: NodeClaimant }) {
  return (
    <section aria-label="Claimant" className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">Claimant</h4>
      {claimant.kind === "failed" && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            The executions could not be read: {claimant.message}
            <Button variant="outline" size="sm" onClick={claimant.retry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {claimant.kind === "none" && (
        <p className="text-sm">No running execution for attempt {claimant.attempt}.</p>
      )}
      {claimant.kind === "claimed" && (
        <>
          <FactList
            facts={[
              {
                label: "Claimed by",
                value: claimant.claimant.name ?? claimant.claimant.resource_identity,
              },
              {
                label: "Runtime identity",
                value: (
                  <span className="font-mono text-xs break-all">
                    {claimant.claimant.runtime_identity}
                  </span>
                ),
              },
              { label: "Activity", value: <ActivityValue read={claimant.activity} /> },
            ]}
          />
          {claimant.activity.state === "gone" && (
            <Alert variant="destructive">
              <AlertDescription>
                The instance is not registered. The claim holds until its deadline,{" "}
                {utcDateTime(claimant.deadline)}. Pause frees it.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
