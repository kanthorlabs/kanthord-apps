import { ChevronDownIcon } from "lucide-react";

import { RevealPanel } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { MissionProposal } from "@/api/types";
import { utcDateTime } from "@/lib/format";
import type { GraphModel } from "@/lib/mission-graph";
import { type Fact, FactList } from "./fact-list";
import { NodeLink } from "./node-link";

interface ProposalItemProps {
  readonly model: GraphModel;
  readonly proposal: MissionProposal;
  readonly onSelect: (nodeId: string) => void;
}

function statusOf(proposal: MissionProposal): "open" | "approved" | "rejected" {
  if (proposal.approved_at !== null) return "approved";
  if (proposal.rejected_at !== null) return "rejected";
  return "open";
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

export function ProposalItem({ model, proposal, onSelect }: ProposalItemProps) {
  const { content } = proposal;
  const status = statusOf(proposal);
  const facts: Fact[] = [
    {
      label: "Dependency",
      value: <NodeLink model={model} nodeId={content.dependency_id} onSelect={onSelect} />,
    },
    { label: "Requirement", value: content.requirement },
    { label: "Criterion", value: content.criterion },
    { label: "Task", value: content.task.name },
    { label: "Task requirement", value: content.task.requirement },
    { label: "Task criterion", value: content.task.criterion },
    { label: "Verifications", value: <CommandList commands={content.task.verifications} /> },
  ];
  if (proposal.approved_at !== null) {
    facts.push({ label: "Approved", value: utcDateTime(proposal.approved_at) });
  }
  if (proposal.rejected_at !== null) {
    facts.push({ label: "Rejected", value: utcDateTime(proposal.rejected_at) });
  }
  if (proposal.created_node_id !== null) {
    facts.push({
      label: "Created node",
      value: <NodeLink model={model} nodeId={proposal.created_node_id} onSelect={onSelect} />,
    });
  }

  return (
    <Collapsible role="listitem" className="flex flex-col">
      <Item variant="outline" size="sm">
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full flex-wrap break-words">
            {content.name}
            <Badge variant={status === "open" ? "outline" : "secondary"}>{status}</Badge>
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
        </div>
      </RevealPanel>
    </Collapsible>
  );
}
