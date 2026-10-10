import { ChevronDownIcon } from "lucide-react";

import { RecordName } from "@/components/record-name";
import { RevealPanel } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { MissionProposal } from "@/api/types";
import { utcDateTime } from "@/lib/format";
import type { GraphModel } from "@/lib/mission-graph";
import type { ProposalApproveState } from "../use-proposal-approve";
import { FactList, type Fact } from "./fact-list";
import { NodeLink } from "./node-link";

interface ProposalItemProps {
  readonly model: GraphModel;
  readonly proposal: MissionProposal;
  readonly approve: ProposalApproveState;
  readonly onSelect: (nodeId: string) => void;
}

function CommandList({ commands }: { commands: readonly string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-0.5 pl-4">
      {commands.map((command, index) => (
        <li key={`${index}-${command}`} className="font-mono text-xs break-all">
          {command}
        </li>
      ))}
    </ol>
  );
}

export function ProposalItem({ model, proposal, approve, onSelect }: ProposalItemProps) {
  const { content } = proposal;
  const unavailable = approve.unavailableReason(proposal);
  const facts: Fact[] = [
    {
      label: "Targets",
      value: <NodeLink model={model} nodeId={content.objective_id} onSelect={onSelect} />,
    },
    { label: "Requirement", value: content.requirement },
    { label: "Criterion", value: content.criterion },
    { label: "Task", value: <RecordName>{content.task.name}</RecordName> },
    { label: "Task requirement", value: content.task.requirement },
    { label: "Task criterion", value: content.task.criterion },
    { label: "Verifications", value: <CommandList commands={content.task.verifications} /> },
  ];
  if (proposal.approved_at !== null) {
    facts.push({ label: "Approved", value: utcDateTime(proposal.approved_at) });
  }
  if (proposal.objective_node_id !== null) {
    facts.push({
      label: "Objective",
      value: <NodeLink model={model} nodeId={proposal.objective_node_id} onSelect={onSelect} />,
    });
  }

  return (
    <Collapsible role="listitem" className="flex flex-col">
      <Item variant="outline" size="sm">
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full flex-wrap break-words">
            {content.name}
            <Badge variant={proposal.approved_at === null ? "outline" : "secondary"}>
              {proposal.approved_at === null ? "proposed" : "approved"}
            </Badge>
          </ItemTitle>
          <ItemDescription>
            Attempt {proposal.attempt}, proposed {utcDateTime(proposal.created_at)}
          </ItemDescription>
        </ItemContent>
        <CollapsibleTrigger
          render={<Button variant="outline" size="sm" />}
          aria-label={`Details of the proposal ${content.name}`}
        >
          <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
          Details
        </CollapsibleTrigger>
      </Item>
      <RevealPanel>
        <div className="flex flex-col items-start gap-3 pt-3">
          <FactList facts={facts} />
          {approve.canApprove(proposal) && (
            <Button size="sm" onClick={() => approve.request(proposal)}>
              Approve proposal
            </Button>
          )}
          {unavailable !== null && <p className="text-sm text-muted-foreground">{unavailable}</p>}
        </div>
      </RevealPanel>
    </Collapsible>
  );
}
