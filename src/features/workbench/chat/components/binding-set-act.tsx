import { useState } from "react";

import { readBindingSet } from "@/api/resources/projects";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BindingsPanel } from "@/features/projects/view/components/bindings-panel";
import { useProjectEnvironments } from "@/features/projects/view/use-project-environments";
import { ACT_DONE } from "@/hooks/act-result";
import { useResource } from "@/hooks/use-resource";
import { readFailureLineOf, versionChangeLineOf } from "@/lib/workbench-action";
import { useActLine } from "../use-act-line";
import { useDialogClosed } from "../use-dialog-closed";
import type { ActionActProps } from "./action-act-props";
import { StatusLine } from "./status-line";

function BindingSetSheet({ offer, onSettled, onDialogClosed }: ActionActProps) {
  const [open, setOpen] = useState(true);
  const environments = useProjectEnvironments(offer.target_id);
  useDialogClosed(open, onDialogClosed);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Edit bindings of {offer.target_id}</SheetTitle>
          <SheetDescription>Pick the binding to add or edit.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <BindingsPanel
            projectId={offer.target_id}
            environments={environments.states}
            onWritten={() => onSettled(ACT_DONE)}
            onEnvironmentChanged={environments.refresh}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function BindingSetAct(props: ActionActProps) {
  const { offer, onLine } = props;
  const read = useResource(() => readBindingSet(offer.target_id), [offer.target_id]);
  const changed = read.data === null ? null : versionChangeLineOf(offer, read.data.version);
  const line = read.error === null ? changed : readFailureLineOf(offer, read.error.message);
  useActLine(line, onLine);
  if (line !== null) return null;
  if (read.data === null) return <StatusLine text={`Reading ${offer.target_id}.`} />;
  return <BindingSetSheet {...props} />;
}
