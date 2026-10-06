import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ComposerPickerProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly disabled: boolean;
  readonly onChange: (value: string | null) => void;
}

export function ComposerPicker({ label, value, options, disabled, onChange }: ComposerPickerProps) {
  const items = options.map((option) => ({ value: option, label: option }));
  return (
    <Select items={items} value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className="max-w-full min-w-0">
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
