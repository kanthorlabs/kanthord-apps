import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { BindingInstances } from "../binding-instances";

function WorkerPlacementHint({ entry }: { entry: BindingInstances }) {
  const { binding, missing } = entry;
  return (
    <div className="space-y-1 text-sm">
      <p>
        {missing} {missing === 1 ? "instance is" : "instances are"} missing. Repeat both steps once
        for each missing instance. Each instance needs its own token file and its own{" "}
        <code className="font-mono">cli.yaml</code>.
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          On the server host, run{" "}
          <code className="font-mono break-all">
            kanthord auth jwt generate --project {binding.project_id} --binding {binding.name}{" "}
            --output &lt;file&gt;
          </code>
          .
        </li>
        <li>
          Place the file as <code className="font-mono break-all">cli.yaml</code> with mode{" "}
          <code className="font-mono">0600</code> in{" "}
          <code className="font-mono break-all">$XDG_CONFIG_HOME/kanthord</code> or{" "}
          <code className="font-mono break-all">~/.config/kanthord</code> on the worker host. Do not
          replace a human <code className="font-mono">cli.yaml</code>. Use another user or another{" "}
          <code className="font-mono">XDG_CONFIG_HOME</code> instead. Run{" "}
          <code className="font-mono break-all">kanthord serve worker --endpoint &lt;url&gt;</code>.
          The worker reads <code className="font-mono">client_secret</code> only from{" "}
          <code className="font-mono">cli.yaml</code>.
        </li>
      </ol>
    </div>
  );
}

function ServerShortfallHint() {
  return (
    <p className="text-sm">
      The server starts these instances. A lasting shortfall means the{" "}
      <code className="font-mono">worker.server_slot_limit</code> cap. See the server log for{" "}
      <code className="font-mono">worker.pool.slot_limit</code>.
    </p>
  );
}

export function BindingInstanceItem({ entry }: { entry: BindingInstances }) {
  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex-wrap">
          <span className="font-mono break-all">{entry.binding.name}</span>
          <span className="text-muted-foreground tabular-nums">(v{entry.binding.revision})</span>
          <Badge variant={entry.shortfall ? "destructive" : "secondary"}>
            {entry.live} of {entry.expected} live
          </Badge>
          {entry.disabled && <Badge variant="outline">disabled</Badge>}
        </ItemTitle>
        <ItemDescription className="break-all">
          <RecordName>{entry.binding.config.worker}</RecordName>
          {entry.placement !== null && ` · ${entry.placement}`}
        </ItemDescription>
        {entry.gap === "worker" && <WorkerPlacementHint entry={entry} />}
        {entry.gap === "server" && <ServerShortfallHint />}
      </ItemContent>
    </Item>
  );
}
