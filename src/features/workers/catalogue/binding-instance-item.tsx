import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { BindingInstances } from "./bindings-instances";

function PlacementHint({ binding }: Pick<BindingInstances, "binding">) {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      <li>
        Run{" "}
        <code className="font-mono break-all">
          kanthord auth jwt generate --project {binding.project_id} --binding {binding.name}{" "}
          --output &lt;file&gt;
        </code>
        .
      </li>
      <li>
        Place the file as <code className="font-mono">cli.yaml</code> in the configuration directory
        of the worker host. Run{" "}
        <code className="font-mono break-all">kanthord serve worker --endpoint &lt;url&gt;</code>.
        The worker reads <code className="font-mono">client_secret</code> only from{" "}
        <code className="font-mono">cli.yaml</code>.
      </li>
    </ol>
  );
}

export function BindingInstanceItem({ entry }: { entry: BindingInstances }) {
  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex-wrap">
          <span className="font-mono break-all">{entry.binding.name}</span>
          <Badge variant={entry.live < entry.expected ? "destructive" : "secondary"}>
            {entry.live} of {entry.expected} live
          </Badge>
        </ItemTitle>
        <ItemDescription className="break-all">
          <RecordName>{entry.binding.config.worker}</RecordName>
          {` · ${entry.binding.config.placement ?? "worker"}`}
        </ItemDescription>
        {entry.placementGap && <PlacementHint binding={entry.binding} />}
      </ItemContent>
    </Item>
  );
}
