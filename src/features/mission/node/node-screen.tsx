import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { badgeVariantOf, meaningOf } from "@/lib/node-state";

import { AttemptsTab } from "./components/attempts-tab";
import { DependenciesTab } from "./components/dependencies-tab";
import { RevisionsTab } from "./components/revisions-tab";
import { WhatTab } from "./components/what-tab";
import { WhyNotRunningTab } from "./components/why-not-running-tab";
import { useNode } from "./use-node";
import { NODE_SECTIONS, useNodeSection } from "./use-node-section";

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
  const { section, selectSection } = useNodeSection();

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
          <Badge variant="outline" className="mt-1">
            {node.kind}
          </Badge>
          {node.state !== null && (
            <Badge variant={badgeVariantOf(node.state)} className="mt-1">
              {node.state}
            </Badge>
          )}
        </div>
        {node.state !== null && (
          <>
            <p className="text-sm text-muted-foreground">{meaningOf(node.state)}</p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Attempt: {node.attemptCounter}</span>
              <span>Priority: {node.priority}</span>
            </div>
          </>
        )}
      </div>

      <Tabs value={section} onValueChange={selectSection}>
        <div className="hidden sm:block">
          <TabsList>
            {NODE_SECTIONS.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="sm:hidden">
          <Select value={section} onValueChange={selectSection}>
            <SelectTrigger aria-label="Section" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NODE_SECTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="content">
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
