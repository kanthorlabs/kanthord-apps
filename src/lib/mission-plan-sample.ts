import type { BindingSet, MissionPlanFile } from "@/api/types";

export const PLAN_FILES_DOC_URL =
  "https://kanthord.kanthorlabs.com/viewer.html?p=reference/mission/import.md#plan-files";

const PLACEHOLDER_BINDING = "your-repository-binding";
const NO_REPOSITORY_BINDING_HINT = "Add a repository binding in Bindings before the import.";

export interface SamplePlan {
  readonly file: MissionPlanFile;
  readonly hint: string | null;
}

function samplePlanFile(binding: string): MissionPlanFile {
  const front = [
    "intent: implement",
    "depends_on: []",
    "tags: []",
    "bindings:",
    `  - ${binding}`,
    "verifications:",
    `  - "head -n 1 HEALTH.md | grep -qx 'status: ok'"`,
  ].join("\n");
  return {
    filename: "sample-plan.md",
    content: `---\n${front}\n---\n# Add a HEALTH.md file\n\n## Requirement\n\nAdd a file HEALTH.md at the root of the repository.\n\n## Criterion\n\nThe first line of HEALTH.md is \`status: ok\`.\n`,
  };
}

export function samplePlanHref(file: MissionPlanFile): string {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(file.content)}`;
}

export function samplePlanOf(bindingSet: BindingSet | null): SamplePlan {
  const repositories = Object.entries(bindingSet?.bindings ?? {})
    .filter(([, entry]) => entry.kind === "repository")
    .map(([name]) => name);
  const [only] = repositories;
  return {
    file: samplePlanFile(
      repositories.length === 1 && only !== undefined ? only : PLACEHOLDER_BINDING,
    ),
    hint: bindingSet !== null && repositories.length === 0 ? NO_REPOSITORY_BINDING_HINT : null,
  };
}
