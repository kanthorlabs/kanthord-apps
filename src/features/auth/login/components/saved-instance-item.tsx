import { DataListItem } from "@/components/data-list-item";
import { Button } from "@/components/ui/button";
import { VerifyStatus } from "@/features/auth/instances/components/verify-status";
import type { SavedInstance } from "@/features/auth/instances/instance-storage";
import type { SavedInstanceRow } from "../use-saved-instances";

interface SavedInstanceItemProps {
  readonly row: SavedInstanceRow;
  readonly busy: boolean;
  readonly onSignIn: (instance: SavedInstance) => void;
  readonly onVerify: (instance: SavedInstance) => void;
  readonly onEdit: (instance: SavedInstance) => void;
  readonly onDelete: (id: string) => void;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

export function SavedInstanceItem({
  row,
  busy,
  onSignIn,
  onVerify,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: SavedInstanceItemProps) {
  const { instance } = row;

  if (row.mode === "delete") {
    return (
      <DataListItem
        title={instance.name}
        description={instance.baseUrl}
        notice={
          <p role="alert" className="text-sm break-words">
            Delete {instance.name}? This browser forgets its endpoint and token. The instance itself
            does not change.
          </p>
        }
        actions={
          <>
            <Button variant="outline" size="lg" onClick={onCancelDelete}>
              Keep
            </Button>
            <Button variant="destructive" size="lg" onClick={onConfirmDelete}>
              Delete instance
            </Button>
          </>
        }
      />
    );
  }

  return (
    <DataListItem
      title={instance.name}
      description={instance.baseUrl}
      select={{
        label: `Sign in to ${instance.name}`,
        disabled: busy,
        onSelect: () => onSignIn(instance),
      }}
      notice={<SavedInstanceNotice row={row} />}
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            aria-label={`Verify ${instance.name}`}
            onClick={() => onVerify(instance)}
          >
            Verify
          </Button>
          <Button
            variant="outline"
            size="lg"
            aria-label={`Edit ${instance.name}`}
            onClick={() => onEdit(instance)}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="lg"
            aria-label={`Delete ${instance.name}`}
            onClick={() => onDelete(instance.id)}
          >
            Delete
          </Button>
        </>
      }
    />
  );
}

function SavedInstanceNotice({ row }: { row: SavedInstanceRow }) {
  return (
    <div className="flex flex-col gap-1">
      {row.signingIn && (
        <p role="status" className="text-sm text-muted-foreground">
          Signing in…
        </p>
      )}
      {row.signInError !== null && (
        <p role="alert" className="text-sm break-words text-destructive">
          {row.signInError}
        </p>
      )}
      <VerifyStatus state={row.verifyState} />
    </div>
  );
}
