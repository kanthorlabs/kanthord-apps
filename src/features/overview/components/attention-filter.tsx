import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AttentionGroup as Group, AttentionGroupId, AttentionItem } from "@/lib/attention";

const ALL = "all";

interface AttentionFilterProps {
  readonly groups: readonly { readonly group: Group; readonly items: readonly AttentionItem[] }[];
  readonly value: AttentionGroupId | null;
  readonly onChange: (groupId: AttentionGroupId | null) => void;
}

export function AttentionFilter({ groups, value, onChange }: AttentionFilterProps) {
  const total = groups.reduce((count, entry) => count + entry.items.length, 0);
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      aria-label="Show the items of"
      className="flex-wrap"
      value={[value ?? ALL]}
      onValueChange={(next: string[]) => {
        const picked = groups.find((entry) => entry.group.id === next[0]);
        onChange(picked === undefined ? null : picked.group.id);
      }}
    >
      <ToggleGroupItem value={ALL}>All · {total}</ToggleGroupItem>
      {groups.map(({ group, items }) => (
        <ToggleGroupItem key={group.id} value={group.id}>
          {group.heading} · {items.length}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
