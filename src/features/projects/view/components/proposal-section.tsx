import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import type { MissionProposal, MissionRunnableNode } from "@/api/types";
import type { Resource } from "@/hooks/use-resource";
import type { GraphModel } from "@/lib/mission-graph";
import { useProposalApprove } from "../use-proposal-approve";
import { ProposalApproveDialog } from "./proposal-approve-dialog";
import { ProposalItem } from "./proposal-item";

interface ProposalSectionProps {
  readonly model: GraphModel;
  readonly initiative: MissionRunnableNode;
  readonly proposals: Resource<readonly MissionProposal[]>;
  readonly missionVersion: number;
  readonly onChanged: () => void;
  readonly onSelect: (nodeId: string) => void;
}

export function ProposalSection({
  model,
  initiative,
  proposals,
  missionVersion,
  onChanged,
  onSelect,
}: ProposalSectionProps) {
  const approve = useProposalApprove(initiative, missionVersion, onChanged);

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
        A judgement of this initiative proposes a fix objective for a defect in a completed
        objective. Approve creates the objective with its task under this initiative and unblocks
        the initiative.
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
