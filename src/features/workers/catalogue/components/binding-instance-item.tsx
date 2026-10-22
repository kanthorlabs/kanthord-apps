import { Fragment } from "react";
import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { BindingRemoveAction } from "@/features/projects/view/components/binding-remove-action";
import { workerPagePath } from "@/lib/worker-paths";
import type { BindingInstances } from "../binding-instances";

function WorkerPlacementHint({ entry }: { entry: BindingInstances }) {
  const { missing, unregistered } = entry;
  return (
    <p className="text-sm">
      {missing} {missing === 1 ? "instance" : "instances"} missing. Start{" "}
      <code className="font-mono">kanthord serve worker --instance &lt;name&gt;</code> on the host
      of each listed instance that is not registered:{" "}
      {unregistered.map((instance, index) => (
        <Fragment key={instance}>
          {index > 0 && ", "}
          <RecordName>{instance}</RecordName>
        </Fragment>
      ))}
      . <Link to={workerPagePath(entry.binding.config.worker)}>Open the worker page</Link>
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

export function BindingInstanceItem({
  entry,
  onChanged,
}: {
  entry: BindingInstances;
  onChanged: () => void;
}) {
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
      <ItemActions className="basis-full md:basis-auto md:justify-end">
        <BindingRemoveAction
          projectId={entry.binding.project_id}
          bindingName={entry.binding.name}
          removed={entry.binding.removed_at !== null}
          onChanged={onChanged}
        />
      </ItemActions>
    </Item>
  );
}
