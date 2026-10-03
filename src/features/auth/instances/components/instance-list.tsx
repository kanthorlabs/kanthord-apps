import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import type { Instance } from "../instance-storage";
import type { VerifyState } from "../use-instance-verify";
import { VerifyStatus } from "./verify-status";

interface InstanceListProps {
  readonly instances: readonly Instance[];
  readonly defaultId: string | null;
  readonly verifyStates: Readonly<Record<string, VerifyState>>;
  readonly onVerify: (instance: Instance) => void;
  readonly onEdit: (instance: Instance) => void;
  readonly onSetDefault: (id: string) => void;
  readonly onRemove: (id: string) => void;
}

export function InstanceList({
  instances,
  defaultId,
  verifyStates,
  onVerify,
  onEdit,
  onSetDefault,
  onRemove,
}: InstanceListProps) {
  return (
    <ItemGroup>
      {instances.map((instance) => (
        <Item
          key={instance.id}
          role="listitem"
          aria-label={instance.name}
          variant="outline"
          size="sm"
        >
          <ItemContent className="min-w-0">
            <ItemTitle className="max-w-full">
              <span className="truncate">{instance.name}</span>
              {instance.id === defaultId && <Badge variant="outline">Default</Badge>}
            </ItemTitle>
            <ItemDescription className="break-all">{instance.baseUrl}</ItemDescription>
            <VerifyStatus state={verifyStates[instance.id]} />
          </ItemContent>
          <ItemActions className="basis-full flex-wrap">
            <Button
              size="sm"
              variant="outline"
              aria-label={`Verify: ${instance.name}`}
              onClick={() => onVerify(instance)}
            >
              Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Edit: ${instance.name}`}
              onClick={() => onEdit(instance)}
            >
              Edit
            </Button>
            {instance.id !== defaultId && (
              <Button
                size="sm"
                variant="outline"
                aria-label={`Set as default: ${instance.name}`}
                onClick={() => onSetDefault(instance.id)}
              >
                Set as default
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              aria-label={`Remove: ${instance.name}`}
              onClick={() => onRemove(instance.id)}
            >
              Remove
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
