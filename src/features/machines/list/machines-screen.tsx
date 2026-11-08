import { PlusIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { WorkerMachineListItem } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Button } from "@/components/ui/button";
import { shortFingerprint } from "@/lib/instance-host";
import { machinePagePath } from "@/lib/worker-paths";
import { useMachines } from "./use-machines";

function MachineItem({ machine }: { machine: WorkerMachineListItem }) {
  return (
    <DataListItem
      title={
        <>
          <span className="font-mono break-all">{machine.name}</span>{" "}
          <span className="text-muted-foreground tabular-nums">(v{machine.revision})</span>
        </>
      }
      fields={[
        {
          label: "Fingerprint",
          value: (
            <span className="font-mono break-all">{shortFingerprint(machine.fingerprint)}</span>
          ),
        },
        { label: "Instances", value: machine.instance_count },
      ]}
      actions={
        <Button
          nativeButton={false}
          render={<Link to={machinePagePath(machine.name)} />}
          variant="outline"
          size="sm"
          aria-label={`Open ${machine.name}`}
        >
          Open
        </Button>
      }
    />
  );
}

export function MachinesScreen() {
  const machines = useMachines();
  const status = machines.loading ? "loading" : machines.error === null ? "ready" : "error";
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        A machine is one computer that runs worker instances. It holds the credentials that its
        instances open.
      </p>
      <div className="flex">
        <Button nativeButton={false} render={<Link to="/machines/new" />} className="md:ml-auto">
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          Add machine
        </Button>
      </div>
      <DataList
        label="Machines"
        items={machines.data ?? []}
        getKey={(machine) => machine.name}
        renderItem={(machine) => <MachineItem machine={machine} />}
        status={status}
        error={machines.error?.message ?? null}
        pending={machines.loading}
        onRetry={machines.reload}
        emptyText="No machines. Create the first one with Add machine."
      />
    </div>
  );
}
