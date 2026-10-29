import { Link } from "react-router-dom";

import type { WorkerInstanceListItem } from "@/api/types";
import { InstanceReachNotice } from "@/components/instance-reach-notice";
import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Resource } from "@/hooks/use-resource";
import type { WorkerDraft } from "@/lib/binding-draft";
import { workerPagePath } from "@/lib/worker-paths";
import type { InstanceSharing } from "../use-instance-sharing";
import { instanceOptionsOf, instancesRemoved } from "../use-worker-instance-choices";

function SharingNotices({ sharing }: { readonly sharing: Resource<readonly InstanceSharing[]> }) {
  if (sharing.error !== null)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <span>The projects of the chosen instances were not read. {sharing.error.message}</span>
          <Button type="button" size="sm" variant="outline" onClick={sharing.reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  return (sharing.data ?? []).map((item) => (
    <InstanceReachNotice key={item.instance} instance={item.instance} projects={item.projects} />
  ));
}

interface InstancesFieldProps {
  readonly projectId: string;
  readonly draft: WorkerDraft;
  readonly saved: readonly string[];
  readonly error: string | undefined;
  readonly instances: Resource<readonly WorkerInstanceListItem[]>;
  readonly sharing: Resource<readonly InstanceSharing[]>;
  readonly onAdd: () => void;
  readonly onEdit: (draft: WorkerDraft) => void;
}

export function InstancesField({
  projectId,
  draft,
  saved,
  error,
  instances,
  sharing,
  onAdd,
  onEdit,
}: InstancesFieldProps) {
  if (draft.worker === "") return null;
  if (instances.loading) return <Skeleton className="h-16 w-full" />;
  if (instances.error !== null)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-destructive">{instances.error.message}</p>
        <Button type="button" size="sm" variant="outline" onClick={instances.reload}>
          Retry
        </Button>
      </div>
    );
  const options = instanceOptionsOf(instances.data ?? [], draft.instances);
  if (options.length === 0)
    return (
      <Field>
        <FieldLabel>Instances</FieldLabel>
        <FieldDescription>
          No instances of <RecordName>{draft.worker}</RecordName>. Add one on the{" "}
          <Link to={workerPagePath(draft.worker, projectId)}>worker page</Link>.
        </FieldDescription>
        <div>
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            Add instance
          </Button>
        </div>
      </Field>
    );
  return (
    <>
      <Field data-invalid={error !== undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel id="binding-instances-label">Instances</FieldLabel>
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            Add instance
          </Button>
        </div>
        <ToggleGroup
          variant="outline"
          size="sm"
          multiple
          aria-labelledby="binding-instances-label"
          aria-invalid={error !== undefined}
          className="flex-wrap"
          value={[...draft.instances]}
          onValueChange={(value: string[]) =>
            onEdit({
              ...draft,
              instances: options
                .map((option) => option.name)
                .filter((name) => value.includes(name)),
            })
          }
        >
          {options.map((option) => (
            <ToggleGroupItem key={option.name} value={option.name}>
              {option.name} · {option.placement}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldDescription>
          The binding runs one kanthord serve worker process on each chosen instance. No chosen
          instance makes the binding unavailable. Manage the instances on the{" "}
          <Link to={workerPagePath(draft.worker, projectId)}>worker page</Link>.
        </FieldDescription>
        {instancesRemoved(saved, draft.instances) && (
          <FieldDescription>
            A removed instance finishes its execution, then takes no new work of this binding.
          </FieldDescription>
        )}
        <FieldError>{error}</FieldError>
      </Field>
      <SharingNotices sharing={sharing} />
    </>
  );
}
