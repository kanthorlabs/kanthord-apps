import { Link } from "react-router-dom";

import type { WorkerMachineInstance } from "@/api/types";
import { instancePagePath } from "@/lib/worker-paths";

export function InstanceNames({
  label,
  instances,
}: {
  label: string;
  instances: readonly WorkerMachineInstance[];
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-1 text-sm">
      {instances.map((instance) => (
        <li key={instance.name} className="break-words">
          <Link
            to={instancePagePath(instance.worker, instance.name)}
            className="font-mono underline underline-offset-4"
          >
            {instance.name}
          </Link>{" "}
          of {instance.worker}
        </li>
      ))}
    </ul>
  );
}
