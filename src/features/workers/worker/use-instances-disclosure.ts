import { useState } from "react";

import type { Resource } from "@/hooks/use-resource";

export interface InstancesDisclosure {
  readonly collapsible: boolean;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

export function useInstancesDisclosure(
  instances: Resource<readonly unknown[]>,
): InstancesDisclosure {
  const [chosen, setOpen] = useState(false);
  const collapsible =
    instances.error === null && instances.data !== null && instances.data.length === 0;
  return { collapsible, open: !collapsible || chosen, setOpen };
}
