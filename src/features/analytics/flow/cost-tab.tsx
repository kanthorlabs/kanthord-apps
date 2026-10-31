import { CostScorecard, CostSkeleton } from "./cost-scorecard";
import { ReadState } from "./read-state";
import type { FlowReadView, FlowView } from "./use-flow";

interface CostTabProps {
  readonly view: FlowReadView & Pick<FlowView, "filters">;
}

export function CostTab({ view }: CostTabProps) {
  return (
    <ReadState view={view} skeleton={<CostSkeleton />}>
      {view.read !== null && <CostScorecard read={view.read} filters={view.filters} />}
    </ReadState>
  );
}
