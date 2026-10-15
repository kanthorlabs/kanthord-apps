import { Fragment } from "react";

import { RecordName } from "@/components/record-name";
import type { AttentionItem, DiscardedDependency } from "@/lib/attention";
import { codeLabel, stopSentence } from "@/lib/execution-stop";
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

function PauseSentence({ item }: { readonly item: Extract<AttentionItem, { kind: "paused" }> }) {
  const { pause } = item;
  if (pause === null) return null;
  const stop = pause.execution?.stop ?? null;
  if (pause.cause === "failure-limit") {
    return <>The last execution ended: {stop === null ? "lost" : stopSentence(stop)}.</>;
  }
  if (pause.cause === "further-work-limit" && stop !== null) {
    return (
      <>
        The last execution ended at its budget
        {stop.code === null ? "" : ` (${codeLabel(stop.code)})`}.
      </>
    );
  }
  return <>No execution limit explains the pause.</>;
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
  if (item.kind === "paused") return <PauseSentence item={item} />;
  const plural = item.discarded.length > 1;
  return (
    <>
      It depends on <DependencyNames discarded={item.discarded} />, which {plural ? "are" : "is"}{" "}
      Discarded. A discarded node satisfies no dependency.
    </>
  );
}
