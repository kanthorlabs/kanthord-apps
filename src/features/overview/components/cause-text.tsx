import { Fragment } from "react";

import { RecordName } from "@/components/record-name";
import type { AttentionItem, DiscardedDependency } from "@/lib/attention";
import { pauseSentence } from "@/lib/execution-stop";
import { closingEventText } from "@/lib/mission-labels";

interface CauseTextProps {
  readonly item: AttentionItem;
}

function DependencyNames({ discarded }: { readonly discarded: readonly DiscardedDependency[] }) {
  return (
    <>
      {discarded.map((dependency, index) => (
        <Fragment key={dependency.id}>
          {index > 0 && (index === discarded.length - 1 ? " and " : ", ")}
          <RecordName>{dependency.name}</RecordName>
        </Fragment>
      ))}
    </>
  );
}

export function CauseText({ item }: CauseTextProps) {
  if (item.kind === "blocked") {
    return (
      <>
        {item.node.blocked_context === undefined
          ? "The node is blocked."
          : closingEventText(item.node.blocked_context.outcome.closing_event)}
      </>
    );
  }
  if (item.kind === "paused") return <>{item.pause === null ? null : pauseSentence(item.pause)}</>;
  const plural = item.discarded.length > 1;
  return (
    <>
      It depends on <DependencyNames discarded={item.discarded} />, which {plural ? "are" : "is"}{" "}
      Discarded. A discarded node satisfies no dependency.
    </>
  );
}
