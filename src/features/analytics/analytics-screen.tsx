import { Link } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CostSection } from "./components/cost-section";
import { TimeSection } from "./components/time-section";
import { FlowTab } from "./flow/flow-tab";
import { FlowToolbar } from "./flow/flow-toolbar";
import { useFlow } from "./flow/use-flow";
import { useAnalytics } from "./use-analytics";

const LINK_CLASS = "underline underline-offset-4 hover:text-foreground";

export function AnalyticsScreen() {
  const flow = useFlow();
  const analytics = useAnalytics();
  const refresh = () => {
    flow.refresh();
    analytics.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {flow.contextLine !== null && <p>{flow.contextLine}</p>}
        <p className="md:ml-auto">
          Live state:{" "}
          <Link to="/" className={LINK_CLASS}>
            Overview
          </Link>{" "}
          ·{" "}
          <Link to="/scheduler" className={LINK_CLASS}>
            Scheduler
          </Link>
        </p>
      </div>
      <FlowToolbar flow={flow} onRefresh={refresh} />
      {flow.rebuildNotice !== null && (
        <Alert>
          <AlertDescription>{flow.rebuildNotice}</AlertDescription>
        </Alert>
      )}
      <Tabs value={flow.filters.tab} onValueChange={flow.selectTab} className="gap-6">
        <TabsList>
          <TabsTrigger value="flow">Flow</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
        </TabsList>
        <TabsContent value="flow">
          <FlowTab view={flow} />
        </TabsContent>
        <TabsContent value="cost" className="flex flex-col gap-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
