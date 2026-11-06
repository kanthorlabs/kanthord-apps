import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExternalLink, MissionExternalAction, MissionNodeRecord } from "@/api/types";
import { useNodeCheck } from "@/hooks/use-node-check";
import { externalLinkOf } from "@/lib/external-link";
import { utcDateTime } from "@/lib/format";
import { useCallback } from "react";
import { useNodeLinkUpdates } from "../use-node-link-updates";

interface LinkUpdateSectionProps {
  readonly node: MissionNodeRecord;
  readonly missionVersion: number;
  readonly actions: readonly MissionExternalAction[] | null;
  readonly onChanged: () => void;
}

const NO_LINKS: readonly ExternalLink[] = [];

function keepAsIs(): void {
  return undefined;
}

function LinkText({ link }: { readonly link: ExternalLink }) {
  const { text, href } = externalLinkOf(link);
  if (href === null) return <span className="break-words">{text}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-words underline">
      {text}
    </a>
  );
}

export function LinkUpdateSection({
  node,
  missionVersion,
  actions,
  onChanged,
}: LinkUpdateSectionProps) {
  const links = node.content.external_links ?? NO_LINKS;
  const updates = useNodeLinkUpdates(node.id, links.length > 0);
  const { reload: reloadUpdates } = updates;
  const reloadAll = useCallback(() => {
    reloadUpdates();
    onChanged();
  }, [reloadUpdates, onChanged]);
  const check = useNodeCheck(node, missionVersion, actions, keepAsIs, reloadAll);

  if (links.length === 0) return null;

  return (
    <section aria-label="External links" className="flex flex-col gap-2">
      <h3 className="font-semibold">External links</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {links.map((link) => (
          <li key={`${link.kind}:${link.resource_identity}:${externalLinkOf(link).text}`}>
            <LinkText link={link} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!check.available || check.checking}
          onClick={check.check}
        >
          Check now
        </Button>
        {check.label !== null && (
          <Badge variant="outline" role="status">
            {check.label}
          </Badge>
        )}
        {check.linkLabels.map((label) => (
          <Badge key={label} variant="outline" role="status" className="max-w-full">
            {label}
          </Badge>
        ))}
      </div>
      <h4 className="text-sm font-medium">Link updates</h4>
      {updates.loading && <Skeleton className="h-12 w-full" />}
      {!updates.loading && updates.data === null && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            {updates.error?.message}
            <Button variant="outline" size="sm" onClick={updates.reload}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {updates.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No update yet.</p>
      )}
      {updates.data !== null && updates.data.length > 0 && (
        <ItemGroup aria-label="Link updates" className="gap-2">
          {updates.data.map((update) => (
            <Item key={update.id} variant="outline" size="sm" role="listitem">
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full flex-wrap">
                  <LinkText link={update.external_link} />
                  {update.new && <Badge variant="secondary">New</Badge>}
                </ItemTitle>
                <ItemDescription className="break-words">
                  {update.actor_id}, {utcDateTime(update.occurred_at)}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  );
}
