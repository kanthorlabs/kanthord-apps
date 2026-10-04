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
import { platformKindLabelOf, type PlatformGroupItems } from "@/lib/credential-platforms";

interface PlatformComboboxProps {
  readonly id: string;
  readonly label?: string;
  readonly groups: readonly PlatformGroupItems[];
  readonly value: string;
  readonly labelOf: (value: string) => string;
  readonly onValueChange: (value: string | null) => void;
}

export function PlatformCombobox({
  id,
  label,
  groups,
  value,
  labelOf,
  onValueChange,
}: PlatformComboboxProps) {
  return (
    <Combobox
      items={groups}
      value={value}
      itemToStringLabel={labelOf}
      onValueChange={onValueChange}
    >
      <ComboboxInput id={id} aria-label={label} className="w-full" placeholder="Search platforms" />
      <ComboboxContent>
        <ComboboxEmpty>No platform matches.</ComboboxEmpty>
        <ComboboxList>
          {(group: PlatformGroupItems) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {group.value !== "" && (
                <ComboboxLabel>{platformKindLabelOf(group.value)}</ComboboxLabel>
              )}
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
