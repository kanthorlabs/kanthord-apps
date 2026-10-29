import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import type { MissionNodeRecord, MissionProposal } from "@/api/types";
import type { Resource } from "@/hooks/use-resource";
import type { GraphModel } from "@/lib/mission-graph";
import { useProposalDecision } from "@/hooks/use-proposal-decision";
import { ProposalDecisionDialog } from "@/components/proposal-decision-dialog";
import { ProposalItem } from "./proposal-item";

const NO_PROPOSALS: readonly MissionProposal[] = [];

interface ProposalSectionProps {
  readonly model: GraphModel;
  readonly proposer: MissionNodeRecord;
  readonly proposals: Resource<readonly MissionProposal[]>;
  readonly missionVersion: number;
  readonly onChanged: () => void;
  readonly onSelect: (nodeId: string) => void;
}

export function ProposalSection({
  model,
  proposer,
  proposals,
  missionVersion,
  onChanged,
  onSelect,
}: ProposalSectionProps) {
  const decision = useProposalDecision(
    proposer,
    proposals.data ?? NO_PROPOSALS,
    missionVersion,
    onChanged,
  );

  if (proposals.loading) return null;
  if (proposals.data === null) {
    return (
      <section aria-label="Fix proposals" className="flex flex-col gap-2">
        <h3 className="font-semibold">Fix proposals</h3>
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            {proposals.error?.message}
            <Button variant="outline" size="sm" onClick={proposals.reload}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </section>
    );
  }
  if (proposals.data.length === 0) return null;

  return (
    <section aria-label="Fix proposals" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Fix proposals</h3>
        {decision.available && (
          <Button size="sm" onClick={decision.request}>
            Decide
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        A judgement of this examine node proposes a fix node for each defect in a completed
        dependency. Decide creates a fix node for each checked proposal, rejects the others and
        unblocks this node.
      </p>
      {decision.unavailableReason !== null && (
        <p className="text-sm text-muted-foreground">{decision.unavailableReason}</p>
      )}
      <ItemGroup aria-label="Proposals" className="gap-3">
        {proposals.data.map((proposal) => (
          <ProposalItem key={proposal.id} model={model} proposal={proposal} onSelect={onSelect} />
        ))}
      </ItemGroup>
      <ProposalDecisionDialog name={proposer.content.name} decision={decision} />
    </section>
  );
}
