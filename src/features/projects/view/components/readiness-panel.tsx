import { ChevronDownIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";

import type { EnvironmentState, Project } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { RevealPanel } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { ReadFaultsAlert } from "@/features/overview/components/read-faults-alert";
import { stepStateLabel, stepStateVariant } from "@/lib/onboarding";
import { useProjectReadiness, type ReadinessItem } from "../use-project-readiness";

function ReadinessRow({ item }: { readonly item: ReadinessItem }) {
  return (
    <Item variant="outline" size="sm" role="listitem" aria-label={item.title}>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          <span>{item.title}</span>
          <Badge variant={stepStateVariant(item.state)}>{stepStateLabel(item.state)}</Badge>
        </ItemTitle>
        <ItemDescription className="line-clamp-none break-words">
          {item.detail}
          {item.names.map((name, index) => (
            <Fragment key={name}>
              {index === 0 ? " " : ", "}
              <RecordName>{name}</RecordName>
            </Fragment>
          ))}
          {item.after === undefined ? item.names.length > 0 && "." : ` ${item.after}`}
        </ItemDescription>
      </ItemContent>
      {item.link !== null && (
        <ItemActions>
          <Button
            nativeButton={false}
            render={<Link to={item.link.path} />}
            variant="outline"
            size="sm"
          >
            {item.link.label}
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}

function ReadinessRows({
  label,
  items,
}: {
  readonly label: string;
  readonly items: readonly ReadinessItem[];
}) {
  return (
    <ItemGroup aria-label={label} className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ReadinessRow key={item.key} item={item} />
      ))}
    </ItemGroup>
  );
}

interface ReadinessPanelProps {
  readonly project: Project;
  readonly environments: readonly EnvironmentState[] | null;
}

export function ReadinessPanel({ project, environments }: ReadinessPanelProps) {
  const readiness = useProjectReadiness(project, environments);
  const ready = readiness.openItems.length === 0;
  const [open, setOpen] = useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<section aria-label="Readiness" />}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Readiness</h3>
          {!readiness.loading && (
            <Badge variant={ready ? "secondary" : "destructive"}>
              {ready ? "Ready" : `${readiness.openItems.length} open`}
            </Badge>
          )}
        </div>
        {!readiness.loading && readiness.doneItems.length > 0 && (
          <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
            <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
            {open
              ? "Hide done steps"
              : `${readiness.doneItems.length} done ${readiness.doneItems.length === 1 ? "step" : "steps"}`}
          </CollapsibleTrigger>
        )}
      </div>
      {readiness.faults.length > 0 && (
        <ReadFaultsAlert faults={readiness.faults} onRetry={readiness.reload} />
      )}
      {readiness.loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          {!ready && <ReadinessRows label="Open readiness steps" items={readiness.openItems} />}
          <RevealPanel>
            <ReadinessRows label="Done readiness steps" items={readiness.doneItems} />
          </RevealPanel>
        </>
      )}
    </Collapsible>
  );
}
