import type { BindingSetEntry } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { isAvailable } from "@/lib/binding-change";

interface BindingItemProps {
  readonly name: string;
  readonly entry: BindingSetEntry;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}

function factsOf(entry: BindingSetEntry): readonly string[] {
  if (entry.kind === "repository") {
    const { config } = entry;
    return [config.address, config.platform, `credential ${config.credential}`];
  }
  if (entry.kind === "worker") {
    const { config } = entry;
    return [
      config.worker,
      `instance count ${config.instanceCount}`,
      config.resourceBudget === undefined
        ? "worker default budget"
        : `budget ${config.resourceBudget.turns} turns, ${config.resourceBudget.wallTimeMs} ms`,
      `agent entries ${config.entries?.length ?? 0}`,
    ];
  }
  const { config } = entry;
  return [
    config.endpoint,
    `bucket ${config.bucket}`,
    config.region,
    config.prefix === "" ? "no prefix" : `prefix ${config.prefix}`,
    `credential ${config.credential}`,
  ];
}

export function BindingItem({ name, entry, onEdit, onRemove }: BindingItemProps) {
  const available = isAvailable(entry);

  return (
    <Item variant="outline" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          <span className="min-w-0 font-mono break-all">{name}</span>
          <Badge variant={available ? "secondary" : "destructive"}>
            {available ? "available" : "unavailable"}
          </Badge>
        </ItemTitle>
        <ItemDescription className="break-words">{factsOf(entry).join(" · ")}</ItemDescription>
      </ItemContent>
      <ItemActions className="basis-full md:basis-auto">
        <Button variant="outline" size="sm" aria-label={`Edit ${name}`} onClick={onEdit}>
          Edit
        </Button>
        <Button variant="outline" size="sm" aria-label={`Remove ${name}`} onClick={onRemove}>
          Remove
        </Button>
      </ItemActions>
    </Item>
  );
}
