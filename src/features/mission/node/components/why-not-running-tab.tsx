import type { EligibilityReport } from "@/api/types";

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
    <div className="space-y-2 p-4">
      {report.checks.map((check) => (
        <div key={check.name} className="flex flex-col gap-1 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-xs font-semibold ${check.holds ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "border-red-300 bg-red-100 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"}`}
            >
              {check.holds ? "pass" : "fail"}
            </span>
            <span className="text-sm font-medium">{check.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{check.detail}</p>
        </div>
      ))}
    </div>
  );
}
