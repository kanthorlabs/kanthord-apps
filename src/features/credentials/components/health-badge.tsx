import type { HealthEntry } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { healthLabel, healthVariant } from "@/lib/credential-health";

export function HealthBadge({ entry }: { entry: HealthEntry | undefined }) {
  return <Badge variant={healthVariant(entry)}>{healthLabel(entry)}</Badge>;
}
