import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { BindingInstances } from "../binding-instances";

function WorkerPlacementHint({ entry }: { entry: BindingInstances }) {
  const { missing } = entry;
  return (
    <p className="text-sm">
      {missing} {missing === 1 ? "instance is" : "instances are"} missing. The worker placement
      waits for the worker instance, which a later version adds. Until then, the server refuses the
      registration of a worker at this placement and hands it no credential. Use the{" "}
      <code className="font-mono">server</code> placement.
    </p>
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

function ContainerShortfallHint() {
  return (
    <p className="text-sm">
      The server starts these instances, each in its own container. Read{" "}
      <code className="font-mono wrap-anywhere">workers/&lt;client_id&gt;/stderr.log</code> in the
      state directory of the server.
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
        {entry.gap === "container" && <ContainerShortfallHint />}
      </ItemContent>
    </Item>
  );
}
