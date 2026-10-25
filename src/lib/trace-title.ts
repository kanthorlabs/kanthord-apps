import type { TraceSummary } from "@/api/types";

import { operationLabel } from "./span-labels";

type TitleFields = Pick<
  TraceSummary,
  "trace_id" | "execution_id" | "root_operation" | "root_attributes"
>;

function rootLabelOf(trace: TitleFields): string | null {
  if (trace.root_operation === null) return null;
  return operationLabel(trace.root_operation, trace.root_attributes ?? {});
}

export function traceTitleOf(trace: TitleFields, nodeName: string | null): string {
  return nodeName ?? trace.execution_id ?? rootLabelOf(trace) ?? trace.trace_id;
}
