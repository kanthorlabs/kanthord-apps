import type { MissionActor } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { actorText } from "@/lib/mission-labels";

export function ActorLabel({ actor }: { actor: MissionActor }) {
  if (actor.kind === "human") {
    return (
      <>
        <RecordName>{actor.name}</RecordName> ({actor.account})
      </>
    );
  }
  if (actor.kind === "execution" && actor.name !== null) {
    return (
      <>
        <RecordName>{actor.name}</RecordName> ({actor.execution_id})
      </>
    );
  }
  return <>{actorText(actor)}</>;
}
