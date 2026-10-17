import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import type { MissionNodeRecord, MissionProposal } from "@/api/types";
import type { Resource } from "@/hooks/use-resource";
import type { GraphModel } from "@/lib/mission-graph";
import { useProposalApprove } from "@/hooks/use-proposal-approve";
import { ProposalApproveDialog } from "@/components/proposal-approve-dialog";
import { ProposalItem } from "./proposal-item";

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
  const approve = useProposalApprove(proposer, missionVersion, onChanged);

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
      <h3 className="font-semibold">Fix proposals</h3>
      <p className="text-sm text-muted-foreground">
        A judgement of this examine node proposes a fix node for a defect in a completed dependency.
        Approve creates the fix node with its task, adds it as a dependency of this node and
        unblocks this node.
      </p>
      <ItemGroup aria-label="Proposals" className="gap-3">
        {proposals.data.map((proposal) => (
          <ProposalItem
            key={proposal.id}
            model={model}
            proposal={proposal}
            approve={approve}
            onSelect={onSelect}
          />
        ))}
      </ItemGroup>
      <ProposalApproveDialog approve={approve} />
    </section>
  );
}
