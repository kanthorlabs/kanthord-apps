import { useMemo } from "react";

import type { ReadFault } from "@/features/overview/read-overview-snapshot";
import { useResource } from "@/hooks/use-resource";
import { hasOpenStep, onboardingStepsOf, type OnboardingStep } from "@/lib/onboarding";

import { readOnboarding } from "./read-onboarding";
import { useOnboardingSkip } from "./use-onboarding-skip";

export type OnboardingView = "loading" | "onboarding" | "overview";

export interface OnboardingState {
  readonly view: OnboardingView;
  readonly steps: readonly OnboardingStep[];
  readonly faults: readonly ReadFault[];
  readonly resumable: boolean;
  readonly skip: () => void;
  readonly resume: () => void;
  readonly reload: () => void;
}

const NO_STEPS: readonly OnboardingStep[] = [];
const NO_FAULTS: readonly ReadFault[] = [];

export function useOnboarding(): OnboardingState {
  const { data, loading, reload } = useResource(readOnboarding, []);
  const { skipped, skip, resume } = useOnboardingSkip();
  const steps = useMemo(() => (data === null ? NO_STEPS : onboardingStepsOf(data.facts)), [data]);
  const open = hasOpenStep(steps);
  const view: OnboardingView =
    data === null && loading ? "loading" : open && !skipped ? "onboarding" : "overview";

  return {
    view,
    steps,
    faults: data?.faults ?? NO_FAULTS,
    resumable: open && skipped,
    skip,
    resume,
    reload,
  };
}
