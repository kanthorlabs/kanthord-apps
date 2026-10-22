import { Trash2Icon } from "lucide-react";

import { DisabledAction } from "@/components/disabled-action";
import { Button } from "@/components/ui/button";
import { useBindingRemove } from "../use-binding-remove";
import { BindingGuardDialog } from "./binding-guard-dialog";

interface BindingRemoveActionProps {
  readonly projectId: string;
  readonly bindingName: string;
  readonly removed: boolean;
  readonly onChanged: () => void;
}

export function BindingRemoveAction({
  projectId,
  bindingName,
  removed,
  onChanged,
}: BindingRemoveActionProps) {
  const remove = useBindingRemove(projectId, bindingName, onChanged);
  const icon = <Trash2Icon aria-hidden="true" data-icon="inline-start" />;
  if (removed) {
    return (
      <DisabledAction
        label="Remove"
        ariaLabel={`Remove ${bindingName}`}
        reason={`${bindingName} is already removed. A removed binding takes no change.`}
        icon={icon}
      />
    );
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label={`Remove ${bindingName}`}
        aria-busy={remove.reading}
        disabled={remove.reading}
        onClick={remove.request}
      >
        {icon}
        Remove
      </Button>
      <BindingGuardDialog
        guard={remove.guard}
        saving={remove.saving}
        onConfirm={remove.confirm}
        onSafer={remove.takeSaferPath}
      />
    </>
  );
}
