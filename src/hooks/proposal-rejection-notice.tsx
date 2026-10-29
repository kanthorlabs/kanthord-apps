import { Fragment, type ReactNode } from "react";

import type { MissionNodeRecord, MissionProposal } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { openProposalsOf } from "@/lib/attention";

export function proposalRejectionNoticeOf(
  act: string,
  consequence: string,
  node: MissionNodeRecord,
  proposals: readonly MissionProposal[],
): ReactNode {
  if (node.intent !== "examine" || node.state !== "Blocked") return null;
  const open = openProposalsOf(node, proposals);
  if (open.length === 0) return null;
  return (
    <>
      {act} rejects the open proposals:{" "}
      {open.map((proposal, index) => (
        <Fragment key={proposal.id}>
          {index > 0 && ", "}
          <RecordName>{proposal.content.name}</RecordName>
        </Fragment>
      ))}
      . {consequence}
    </>
  );
}
