import type { NodeClaimant } from "../use-node-claimant";
import { FactList } from "./fact-list";

export function NodeClaimantFacts({ claimant, activity }: NodeClaimant) {
  return (
    <section aria-label="Claimant" className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">Claimant</h4>
      <FactList
        facts={[
          { label: "Claimed by", value: claimant.name ?? claimant.runtime_identity },
          {
            label: "Runtime identity",
            value: <span className="font-mono text-xs break-all">{claimant.runtime_identity}</span>,
          },
          { label: "Activity", value: activity ?? "not reported" },
        ]}
      />
    </section>
  );
}
