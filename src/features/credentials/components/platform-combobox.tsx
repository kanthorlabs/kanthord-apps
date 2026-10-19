import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import type { PlatformGroup } from "@/lib/credential-platforms";

function sameLabel(value: string): string {
  return value;
}

interface PlatformComboboxProps {
  readonly id: string;
  readonly label?: string;
  readonly items: readonly string[];
  readonly groups?: readonly PlatformGroup[] | null;
  readonly value: string;
  readonly labelOf?: (value: string) => string;
  readonly onValueChange: (value: string | null) => void;
}

export function PlatformCombobox({
  id,
  label,
  items,
  groups = null,
  value,
  labelOf = sameLabel,
  onValueChange,
}: PlatformComboboxProps) {
  return (
    <Combobox
      items={groups ?? items}
      value={value}
      itemToStringLabel={labelOf}
      onValueChange={onValueChange}
    >
      <ComboboxInput id={id} aria-label={label} className="w-full" placeholder="Search platforms" />
      <ComboboxContent>
        <ComboboxEmpty>No platform matches.</ComboboxEmpty>
        <ComboboxList>
          {groups === null
            ? (item: string) => (
                <ComboboxItem key={item} value={item}>
                  {labelOf(item)}
                </ComboboxItem>
              )
            : (group: PlatformGroup) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.value}</ComboboxLabel>
                  <ComboboxCollection>
                    {(item: string) => (
                      <ComboboxItem key={item} value={item}>
                        {labelOf(item)}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
