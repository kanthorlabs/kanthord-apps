import type { LivenessReport } from "@/api/types";

export function unavailableComponentsOf(report: LivenessReport): readonly string[] {
  return Object.entries(report.services).flatMap(([component, checks]) =>
    Object.entries(checks).flatMap(([check, code]) =>
      code === 200 ? [] : [`${component}.${check} unavailable`],
    ),
  );
}
