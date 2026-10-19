import { Fragment } from "react";
import { Link } from "react-router-dom";

import type { Project } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          {item.names.length > 0 && "."}
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

export function ReadinessPanel({ project }: { readonly project: Project }) {
  const readiness = useProjectReadiness(project);
  return (
    <section aria-label="Readiness" className="flex flex-col gap-2">
      <h3 className="font-semibold">Readiness</h3>
      {readiness.faults.length > 0 && (
        <ReadFaultsAlert faults={readiness.faults} onRetry={readiness.reload} />
      )}
      {readiness.loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <ItemGroup
          aria-label="Readiness steps"
          className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
        >
          {readiness.items.map((item) => (
            <ReadinessRow key={item.key} item={item} />
          ))}
        </ItemGroup>
      )}
    </section>
  );
}
