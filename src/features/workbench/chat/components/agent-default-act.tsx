import { useState } from "react";

import type { AgentEnablement } from "@/api/types";
import { DefaultConfigurationSheet } from "@/features/workers/agent/components/default-configuration-sheet";
import { useAgent } from "@/features/workers/agent/use-agent";
import { ACT_DONE } from "@/hooks/act-result";
import { readFailureLineOf, revisionChangeLineOf } from "@/lib/workbench-action";
import { useActLine } from "../use-act-line";
import { useDialogClosed } from "../use-dialog-closed";
import type { ActionActProps } from "./action-act-props";
import { StatusLine } from "./status-line";

interface AgentDefaultSheetProps extends ActionActProps {
  readonly enablement: AgentEnablement;
}

function AgentDefaultSheet({
  offer,
  onSettled,
  onDialogClosed,
  enablement,
}: AgentDefaultSheetProps) {
  const [open, setOpen] = useState(true);
  useDialogClosed(open, onDialogClosed);
  return (
    <DefaultConfigurationSheet
      agentName={offer.target_id}
      enablement={enablement}
      open={open}
      onClose={() => setOpen(false)}
      onSaved={() => {
        setOpen(false);
        onSettled(ACT_DONE);
      }}
    />
  );
}

export function AgentDefaultAct(props: ActionActProps) {
  const { offer, onLine } = props;
  const read = useAgent(offer.target_id);
  const enablement = read.data?.agent.enablement ?? null;
  const changed =
    read.data === null ? null : revisionChangeLineOf(offer, enablement?.revision ?? null);
  const line = read.error === null ? changed : readFailureLineOf(offer, read.error.message);
  useActLine(line, onLine);
  if (line !== null) return null;
  if (read.data === null || enablement === null) {
    return <StatusLine text={`Reading ${offer.target_id}.`} />;
  }
  return <AgentDefaultSheet {...props} enablement={enablement} />;
}
