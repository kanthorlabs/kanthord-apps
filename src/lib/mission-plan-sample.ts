import type { MissionPlanFile } from "@/api/types";

export const PLAN_FILES_DOC_URL =
  "https://kanthord.kanthorlabs.com/viewer.html?p=reference/mission/import.md#plan-files";

export function samplePlanFile(): MissionPlanFile {
  const front = [
    "intent: implement",
    "depends_on: []",
    "tags: []",
    "bindings:",
    "  - your-repository-binding",
    "verifications:",
    "  - npm test",
  ].join("\n");
  return {
    filename: "sample-plan.md",
    content: `---\n${front}\n---\n# Add a health endpoint\n\n## Requirement\n\nServe the status of the service at GET /health.\n\n## Criterion\n\nGET /health answers 200 with a JSON body that holds the status.\n`,
  };
}

export function samplePlanHref(file: MissionPlanFile): string {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(file.content)}`;
}
