import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface PlatformComboboxProps {
  readonly id: string;
  readonly label?: string;
  readonly items: readonly string[];
  readonly value: string;
  readonly labelOf: (value: string) => string;
  readonly onValueChange: (value: string | null) => void;
}

export function PlatformCombobox({
  id,
  label,
  items,
  value,
  labelOf,
  onValueChange,
}: PlatformComboboxProps) {
  return (
    <Combobox items={items} value={value} itemToStringLabel={labelOf} onValueChange={onValueChange}>
      <ComboboxInput id={id} aria-label={label} className="w-full" placeholder="Search platforms" />
      <ComboboxContent>
        <ComboboxEmpty>No platform matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {labelOf(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
