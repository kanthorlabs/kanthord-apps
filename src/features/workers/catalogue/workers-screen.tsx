import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { counted } from "@/lib/counted";
import { workerPagePath } from "@/lib/worker-paths";
import type { WorkerCatalogItem, WorkerRegistrationRecord } from "@/api/types";
import { BindingInstanceItem } from "./components/binding-instance-item";
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

function CatalogItem({ item, live }: { item: WorkerCatalogItem; live: number | null }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle className="flex-wrap">
          <span className="font-mono">{item.name}</span>
          <Badge variant="secondary">{item.host}</Badge>
        </ItemTitle>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            aria-label={`Open ${item.name}`}
            render={<Link to={workerPagePath(item.name)} />}
          >
            Open
          </Button>
        </ItemActions>
      </ItemHeader>
      <ItemContent className="min-w-0 gap-4">
        {live !== null && (
          <ItemDescription>
            {`${counted(live, "live registration", "live registrations")} in this project`}
          </ItemDescription>
        )}
        <BadgeList label="Declared node states" values={item.declared_node_states} />
        <BadgeList label="Declared intents" values={item.declared_intents} />
      </ItemContent>
    </Item>
  );
}

function RegistrationItem({ registration }: { registration: WorkerRegistrationRecord }) {
  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex-wrap">
          <span className="font-mono break-all">
            {registration.name ?? registration.runtime_identity}
          </span>
          <Badge variant={registration.activity === "idle" ? "secondary" : "default"}>
            {registration.activity}
          </Badge>
          {registration.draining && <Badge variant="outline">draining</Badge>}
        </ItemTitle>
        <ItemDescription className="break-all">
          <RecordName>{registration.worker_name}</RecordName> ·{" "}
          <RecordName>{registration.host}</RecordName>
          {registration.host === "kanthord" ? ` · ${registration.placement}` : ""}
          {registration.execution_id !== undefined ? ` · ${registration.execution_id}` : ""}
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
  const { catalog, registrations, bindings, bindingEntries, liveCounts } = useWorkers();
  const liveKnown = registrations.data !== null;
  const catalogItems = catalog.data ?? [];
  const registrationItems = registrations.data ?? [];

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
              <CatalogItem
                key={item.name}
                item={item}
                live={liveKnown ? (liveCounts[item.name] ?? 0) : null}
              />
            ))}
          </ItemGroup>
        )}
      </Section>

      <Separator />

      <Section
        id="bindings-heading"
        title="Worker bindings"
        loading={bindings.loading || registrations.loading || catalog.loading}
        error={bindings.error ?? registrations.error ?? catalog.error}
        reload={() => {
          bindings.reload();
          registrations.reload();
          catalog.reload();
        }}
      >
        {bindingEntries.length === 0 ? (
          <EmptyList title="No worker bindings." />
        ) : (
          <ItemGroup className="gap-2">
            {bindingEntries.map((entry) => (
              <BindingInstanceItem
                key={entry.binding.id}
                entry={entry}
                onChanged={() => {
                  bindings.reload();
                  registrations.reload();
                }}
              />
            ))}
          </ItemGroup>
        )}
      </Section>

      <Separator />

      <Section
        id="registrations-heading"
        title="Live registrations"
        loading={registrations.loading}
        error={registrations.error}
        reload={registrations.reload}
      >
        {registrationItems.length === 0 ? (
          <EmptyList title="No registrations." />
        ) : (
          <ItemGroup className="gap-2">
            {registrationItems.map((registration) => (
              <RegistrationItem key={registration.runtime_identity} registration={registration} />
            ))}
          </ItemGroup>
        )}
      </Section>
    </div>
  );
}
