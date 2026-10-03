import type { EligibilityReport } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

interface WhyNotRunningTabProps {
  readonly report: EligibilityReport;
}

export function WhyNotRunningTab({ report }: WhyNotRunningTabProps) {
  if (report.checks.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">The daemon reports no eligibility checks.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ItemGroup aria-label="Eligibility checks" className="gap-2">
        {report.checks.map((check) => (
          <Item key={check.name} role="listitem" variant="outline" size="sm">
            <ItemContent className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={check.holds ? "secondary" : "destructive"}>
                  {check.holds ? "pass" : "fail"}
                </Badge>
                <ItemTitle>{check.name}</ItemTitle>
              </div>
              <p className="text-xs break-words text-muted-foreground">{check.detail}</p>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
