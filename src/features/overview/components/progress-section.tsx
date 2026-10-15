import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup, ItemMedia } from "@/components/ui/item";
import { badgeVariantOf } from "@/lib/node-state";

import type { ProjectProgress } from "../use-overview";

interface ProgressSectionProps {
  readonly progress: readonly ProjectProgress[];
}

export function ProgressSection({ progress }: ProgressSectionProps) {
  return (
    <section aria-labelledby="overview-progress" className="flex flex-col gap-3">
      <h3 id="overview-progress" className="text-base font-semibold">
        Mission progress
      </h3>
      {progress.map(({ project, tallies }) => {
        const to = `/projects/${encodeURIComponent(project.id)}`;
        return (
          <div key={project.id} className="flex flex-col gap-2">
            <h4 className="text-sm font-medium break-words">{project.name}</h4>
            {tallies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nodes.</p>
            ) : (
              <ItemGroup aria-label={`Node states of ${project.name}`} className="gap-1">
                {tallies.map((tally) => (
                  <div key={tally.state} role="listitem">
                    <Item render={<Link to={to} />} size="sm">
                      <ItemMedia>
                        <Badge variant={badgeVariantOf(tally.state)}>{tally.state}</Badge>
                      </ItemMedia>
                      <ItemContent>
                        <span className="tabular-nums">{tally.count}</span>
                      </ItemContent>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            )}
          </div>
        );
      })}
    </section>
  );
}
