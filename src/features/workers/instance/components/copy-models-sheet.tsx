import { MetadataSheet } from "@/features/credentials/components/metadata-sheet";
import { useMetadataEdit } from "@/features/credentials/use-metadata-edit";
import type { InstanceCopyModelsTarget } from "../use-instance-copy-models";

export function CopyModelsSheet({
  target,
  reload,
}: {
  target: InstanceCopyModelsTarget;
  reload: () => void;
}) {
  const edit = useMetadataEdit("llm", target.credential, target.entry, reload, {
    holder: target.credential.holder,
    reportedModelIds: target.reportedModelIds,
    openAtStart: true,
  });
  return (
    <MetadataSheet
      name={`${target.credential.name} on ${target.credential.holder}`}
      entry={target.entry}
      edit={edit}
    />
  );
}
