import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meaningOf, stateClasses } from "@/lib/node-state";

import { AttemptsTab } from "./components/attempts-tab";
import { DependenciesTab } from "./components/dependencies-tab";
import { RevisionsTab } from "./components/revisions-tab";
import { WhatTab } from "./components/what-tab";
import { WhyNotRunningTab } from "./components/why-not-running-tab";
import { useNode } from "./use-node";

function HeaderSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

export function NodeScreen() {
  const { nodeId = "" } = useParams<{ nodeId: string }>();
  const resources = useNode(nodeId);

  if (resources.loading) return <HeaderSkeleton />;

  if (resources.error !== null) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-destructive">{resources.error.message}</p>
        <Button variant="outline" size="sm" onClick={resources.node.reload}>
          Retry
        </Button>
      </div>
    );
  }

  const node = resources.node.data;
  const attempts = resources.attempts.data ?? [];
  const revisions = resources.revisions.data ?? [];
  const closure = resources.closure.data;
  const eligibility = resources.eligibility.data;

  if (node === null) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <h1 className="text-xl font-semibold">{node.title}</h1>
          <span className="mt-0.5 inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-xs text-muted-foreground">
            {node.kind}
          </span>
          {node.state !== null && (
            <span
              className={`mt-0.5 inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium ${stateClasses(node.state)}`}
              title={meaningOf(node.state)}
            >
              {node.state}
            </span>
          )}
        </div>
        {node.state !== null && (
          <p className="text-sm text-muted-foreground">{meaningOf(node.state)}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Priority: {node.priority}</span>
          <span>Attempts: {node.attemptCounter}</span>
        </div>
      </div>

      <Tabs defaultValue="what">
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
            <TabsTrigger value="what">WHAT</TabsTrigger>
            <TabsTrigger value="attempts">Attempts</TabsTrigger>
            <TabsTrigger value="revisions">Revisions</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
            <TabsTrigger value="why">Why not running</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="what">
          <WhatTab node={node} />
        </TabsContent>

        <TabsContent value="attempts">
          <AttemptsTab attempts={attempts} />
        </TabsContent>

        <TabsContent value="revisions">
          <RevisionsTab revisions={revisions} />
        </TabsContent>

        <TabsContent value="dependencies">
          {closure !== null ? (
            <DependenciesTab closure={closure} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No closure data.</p>
          )}
        </TabsContent>

        <TabsContent value="why">
          {eligibility !== null ? (
            <WhyNotRunningTab report={eligibility} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No eligibility data.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
