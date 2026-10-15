import type { Project } from "@/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_PROJECTS = "all";

interface ProjectFilterProps {
  readonly projects: readonly Project[];
  readonly value: string | null;
  readonly onChange: (projectId: string | null) => void;
}

export function ProjectFilter({ projects, value, onChange }: ProjectFilterProps) {
  const items = [
    { value: ALL_PROJECTS, label: "All projects" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  return (
    <Select
      items={items}
      value={value ?? ALL_PROJECTS}
      onValueChange={(next) => onChange(next === null || next === ALL_PROJECTS ? null : next)}
    >
      <SelectTrigger aria-label="Project" className="w-full">
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
