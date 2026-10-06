import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentFilterProps {
  readonly value: string;
  readonly options: readonly string[];
  readonly labelOf: (value: string) => string;
  readonly onChange: (value: string | null) => void;
}

export function AgentFilter({ value, options, labelOf, onChange }: AgentFilterProps) {
  const items = options.map((option) => ({ value: option, label: labelOf(option) }));
  return (
    <Select items={items} value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Agent" className="w-full">
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
