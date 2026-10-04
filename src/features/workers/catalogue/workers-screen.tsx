import type { ReactNode } from "react";

import type { ApiError } from "@/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkerCatalogItem, WorkerInstanceRecord } from "@/api/types";
import { useWorkers } from "./use-workers";

function BadgeList({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => (
          <Badge key={value} variant="outline">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CatalogItem({ item }: { item: WorkerCatalogItem }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle className="flex-wrap">
          <span className="font-mono">{item.name}</span>
          <Badge variant="secondary">{item.host}</Badge>
        </ItemTitle>
      </ItemHeader>
      <ItemContent className="min-w-0 gap-4">
        <BadgeList label="Declared node states" values={item.declaredNodeStates} />
        <BadgeList label="Required node format" values={item.requiredNodeFormat} />
      </ItemContent>
    </Item>
  );
}

function InstanceItem({ instance }: { instance: WorkerInstanceRecord }) {
  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex-wrap">
          <span className="font-mono break-all">{instance.name ?? instance.runtimeIdentity}</span>
          <Badge variant={instance.activity === "idle" ? "secondary" : "default"}>
            {instance.activity}
          </Badge>
          {instance.draining && <Badge variant="outline">draining</Badge>}
        </ItemTitle>
        <ItemDescription className="break-all">
          {instance.workerName} · {instance.host}
          {instance.host === "kanthord" ? ` · ${instance.placement}` : ""}
          {instance.executionId !== undefined ? ` · ${instance.executionId}` : ""}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

function Section({
  id,
  title,
  loading,
  error,
  reload,
  children,
}: {
  id: string;
  title: string;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold mb-4">
        {title}
      </h2>
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
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
      {!loading && error === null && children}
    </section>
  );
}

function EmptyList({ title }: { title: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

export function WorkersScreen() {
  const { catalog, instances } = useWorkers();
  const catalogItems = catalog.data ?? [];
  const instanceItems = instances.data ?? [];

  return (
    <div className="space-y-8 px-4 lg:px-0">
      <Section
        id="catalogue-heading"
        title="Worker catalogue"
        loading={catalog.loading}
        error={catalog.error}
        reload={catalog.reload}
      >
        {catalogItems.length === 0 ? (
          <EmptyList title="No workers." />
        ) : (
          <ItemGroup className="gap-4 lg:grid lg:grid-cols-2">
            {catalogItems.map((item) => (
              <CatalogItem key={item.name} item={item} />
            ))}
          </ItemGroup>
        )}
      </Section>

      <Separator />

      <Section
        id="instances-heading"
        title="Live instances"
        loading={instances.loading}
        error={instances.error}
        reload={instances.reload}
      >
        {instanceItems.length === 0 ? (
          <EmptyList title="No instances." />
        ) : (
          <ItemGroup className="gap-2">
            {instanceItems.map((instance) => (
              <InstanceItem key={instance.runtimeIdentity} instance={instance} />
            ))}
          </ItemGroup>
        )}
      </Section>
    </div>
  );
}
