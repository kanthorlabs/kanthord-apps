import { Badge } from "@/components/ui/badge";

interface CheckBadgeProps {
  readonly label: string | null;
}

export function CheckBadge({ label }: CheckBadgeProps) {
  if (label === null) return null;
  return (
    <Badge variant="outline" role="status">
      {label}
    </Badge>
  );
}
