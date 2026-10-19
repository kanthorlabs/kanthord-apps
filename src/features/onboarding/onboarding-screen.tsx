import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { ReadFaultsAlert } from "@/features/overview/components/read-faults-alert";
import { OverviewScreen } from "@/features/overview/overview-screen";

import { OnboardingStep } from "./components/onboarding-step";
import { useOnboarding } from "./use-onboarding";

export function OnboardingScreen() {
  const onboarding = useOnboarding();

  if (onboarding.view === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (onboarding.view === "overview") {
    return <OverviewScreen onResume={onboarding.resumable ? onboarding.resume : undefined} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Onboarding</h2>
          <p className="text-sm text-muted-foreground">Finish these steps to run the first task.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onboarding.skip}>
          Skip onboarding
        </Button>
      </div>
      {onboarding.faults.length > 0 && (
        <ReadFaultsAlert faults={onboarding.faults} onRetry={onboarding.reload} />
      )}
      <ItemGroup aria-label="Setup steps" className="gap-2">
        {onboarding.steps.map((step, index) => (
          <OnboardingStep key={step.key} step={step} position={index + 1} />
        ))}
      </ItemGroup>
    </div>
  );
}
