import { ChevronDownIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { RevealPanel } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { badgeVariantOf } from "@/lib/node-state";

import type { ProjectProgress } from "../use-overview";

interface ProgressSectionProps {
  readonly progress: readonly ProjectProgress[];
  readonly summary: string;
}

export function ProgressSection({ progress, summary }: ProgressSectionProps) {
  return (
    <Collapsible
      render={<section aria-labelledby="overview-progress" />}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h3 id="overview-progress" className="text-base font-semibold">
            Mission progress
          </h3>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
          <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
          Node states
        </CollapsibleTrigger>
      </div>
      <RevealPanel>
        <ItemGroup aria-label="Projects" className="gap-2">
          {progress.map(({ project, tallies }) => (
            <div key={project.id} role="listitem">
              <Item
                variant="outline"
                size="sm"
                render={<Link to={`/projects/${encodeURIComponent(project.id)}`} />}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="break-words">{project.name}</ItemTitle>
                  {tallies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No nodes.</p>
                  ) : (
                    <ul
                      aria-label={`Node states of ${project.name}`}
                      className="flex flex-wrap gap-1.5"
                    >
                      {tallies.map((tally) => (
                        <li key={tally.state}>
                          <Badge variant={badgeVariantOf(tally.state)}>
                            {tally.state} <span className="tabular-nums">{tally.count}</span>
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </ItemContent>
              </Item>
            </div>
          ))}
        </ItemGroup>
      </RevealPanel>
    </Collapsible>
  );
}
