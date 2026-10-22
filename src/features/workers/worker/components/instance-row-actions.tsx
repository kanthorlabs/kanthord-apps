import { ArchiveIcon, UnlinkIcon } from "lucide-react";

import type { WorkerInstanceListItem } from "@/api/types";
import { DisabledAction } from "@/components/disabled-action";
import { Button } from "@/components/ui/button";
import { ArchiveInstanceDialog } from "../../instance/components/archive-instance-dialog";
import { useInstanceArchive } from "../../instance/use-instance-archive";
import type { InstanceDetachState } from "../../instance/use-instance-detach";

interface InstanceRowActionsProps {
  readonly instance: WorkerInstanceListItem;
  readonly liveExecutions: readonly string[];
  readonly detach: InstanceDetachState;
  readonly onChanged: () => void;
  readonly projectNameOf: (projectId: string) => string;
}

export function InstanceRowActions({
  instance,
  liveExecutions,
  detach,
  onChanged,
  projectNameOf,
}: InstanceRowActionsProps) {
  const archive = useInstanceArchive(
    {
      name: instance.name,
      revision: instance.revision,
      bindingCount: instance.binding_count,
      liveExecutions,
    },
    onChanged,
    onChanged,
  );
  const detachIcon = <UnlinkIcon aria-hidden="true" data-icon="inline-start" />;
  const archiveIcon = <ArchiveIcon aria-hidden="true" data-icon="inline-start" />;
  return (
    <>
      {instance.binding_count === 0 ? (
        <DisabledAction
          label="Detach"
          ariaLabel={`Detach ${instance.name}`}
          reason={`No binding lists ${instance.name}.`}
          icon={detachIcon}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Detach ${instance.name}`}
          onClick={() => detach.request(instance.name, null)}
        >
          {detachIcon}
          Detach
        </Button>
      )}
      {archive.blocked !== null ? (
        <DisabledAction
          label="Archive"
          ariaLabel={`Archive ${instance.name}`}
          reason={archive.blocked}
          icon={archiveIcon}
        />
      ) : (
        <Button
          variant="destructive"
          size="sm"
          aria-label={`Archive ${instance.name}`}
          aria-busy={archive.reading}
          disabled={archive.reading}
          onClick={archive.request}
        >
          {archiveIcon}
          Archive
        </Button>
      )}
      <ArchiveInstanceDialog name={instance.name} archive={archive} projectNameOf={projectNameOf} />
    </>
  );
}
