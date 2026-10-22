import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

interface FilterSelectProps {
  readonly label: string;
  readonly allLabel: string | null;
  readonly options: readonly FilterOption[];
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
}

export function FilterSelect({ label, allLabel, options, value, onChange }: FilterSelectProps) {
  const items = allLabel === null ? options : [{ value: ALL_VALUE, label: allLabel }, ...options];
  return (
    <Select
      items={items}
      value={value ?? ALL_VALUE}
      onValueChange={(next) => onChange(next === null || next === ALL_VALUE ? null : next)}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
