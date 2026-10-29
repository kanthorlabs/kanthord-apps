import type { WorkerPlacement } from "@/api/types";
import { containerDescriptionOf, type PlacementChoices } from "@/lib/placement-status";

export interface PlacementCard {
  readonly value: WorkerPlacement;
  readonly title: string;
  readonly description: string;
  readonly disabled: boolean;
}

export function placementCardsOf(choices: PlacementChoices): readonly PlacementCard[] {
  return [
    {
      value: "server",
      title: "Server",
      description: "Built in. Runs the instance as a thread of the server.",
      disabled: choices.disabled.includes("server"),
    },
    {
      value: "container",
      title: "Container",
      description: containerDescriptionOf(choices),
      disabled: choices.disabled.includes("container"),
    },
    {
      value: "worker",
      title: "Worker",
      description:
        "Runs the instance as a kanthord serve worker process on a machine that you manage.",
      disabled: choices.disabled.includes("worker"),
    },
  ];
}
