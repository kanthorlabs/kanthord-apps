import type { SpanAttributeValue, TraceSummary } from "@/api/types";

import { operationLabel } from "./span-labels";

const ATTRIBUTE_NODE_NAME = "kanthord.node.name";

type TitleFields = Pick<
  TraceSummary,
  "trace_id" | "execution_id" | "root_operation" | "root_attributes"
>;

export function nodeNameOf(
  attributes: Readonly<Record<string, SpanAttributeValue>> | null | undefined,
): string | null {
  const name = attributes?.[ATTRIBUTE_NODE_NAME];
  return typeof name === "string" ? name : null;
}

function rootLabelOf(trace: TitleFields): string | null {
  if (trace.root_operation === null) return null;
  return operationLabel(trace.root_operation, trace.root_attributes ?? {});
}

export function traceTitleOf(trace: TitleFields, nodeName: string | null): string {
  return nodeName ?? trace.execution_id ?? rootLabelOf(trace) ?? trace.trace_id;
}
