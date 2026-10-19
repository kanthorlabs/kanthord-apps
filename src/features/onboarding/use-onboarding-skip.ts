import { useCallback, useState } from "react";

const SKIP_KEY = "kanthord.onboarding.skipped";

export interface OnboardingSkip {
  readonly skipped: boolean;
  readonly skip: () => void;
  readonly resume: () => void;
}

function readSkipMark(): boolean {
  try {
    return window.localStorage.getItem(SKIP_KEY) !== null;
  } catch {
    return false;
  }
}

function writeSkipMark(skipped: boolean): void {
  try {
    if (skipped) window.localStorage.setItem(SKIP_KEY, "1");
    else window.localStorage.removeItem(SKIP_KEY);
  } catch {
    return;
  }
}

export function useOnboardingSkip(): OnboardingSkip {
  const [skipped, setSkipped] = useState(readSkipMark);

  const skip = useCallback(() => {
    writeSkipMark(true);
    setSkipped(true);
  }, []);

  const resume = useCallback(() => {
    writeSkipMark(false);
    setSkipped(false);
  }, []);

  return { skipped, skip, resume };
}
