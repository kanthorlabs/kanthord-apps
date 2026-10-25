import { AnalyticsToolbar } from "./components/analytics-toolbar";
import { CostSection } from "./components/cost-section";
import { TimeSection } from "./components/time-section";
import { useAnalytics } from "./use-analytics";

export function AnalyticsScreen() {
  const analytics = useAnalytics();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <AnalyticsToolbar {...analytics} />
      <CostSection
        filters={analytics.filters}
        projects={analytics.projects}
        refreshCount={analytics.refreshCount}
      />
      <TimeSection
        filters={analytics.filters}
        projects={analytics.projects}
        refreshCount={analytics.refreshCount}
      />
    </div>
  );
}
