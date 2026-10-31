import { Fragment } from "react";

import { RecordName } from "@/components/record-name";
import type { DecisionAttentionItem, DiscardedDependency } from "@/lib/attention";
import { dependencySeparatorOf, discardedVerbOf } from "@/lib/board-pane-text";
import { pauseSentence } from "@/lib/execution-stop";
import { closingEventText } from "@/lib/mission-labels";

interface CauseTextProps {
  readonly item: DecisionAttentionItem;
}

function DependencyNames({ discarded }: { readonly discarded: readonly DiscardedDependency[] }) {
  return (
    <>
      {discarded.map((dependency, index) => (
        <Fragment key={dependency.id}>
          {dependencySeparatorOf(index, discarded.length)}
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
  return (
    <>
      It depends on <DependencyNames discarded={item.discarded} />, which{" "}
      {discardedVerbOf(item.discarded.length)} Discarded. A discarded node satisfies no dependency.
    </>
  );
}
