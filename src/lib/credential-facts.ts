import type { CredentialModel, CredentialPlatform } from "@/api/types";
import { OPENAI_COMPATIBLE, openAiMetadataOf } from "@/lib/credential-draft";

export interface MetadataFact {
  readonly label: string;
  readonly value: string;
}

export function modelSummary(model: CredentialModel): string {
  const parts = [model.id];
  if (model.context_window !== undefined) parts.push(`context ${model.context_window}`);
  if (model.max_tokens !== undefined) parts.push(`max tokens ${model.max_tokens}`);
  if (model.reasoning_levels !== undefined) {
    parts.push(`reasoning ${model.reasoning_levels.join(", ")}`);
  }
  return parts.join(" · ");
}

export function metadataFacts(
  platform: CredentialPlatform,
  metadata: Readonly<Record<string, unknown>> | null,
): readonly MetadataFact[] {
  if (metadata === null) return [];
  if (platform === OPENAI_COMPATIBLE) {
    const current = openAiMetadataOf(metadata);
    return [
      { label: "Base URL", value: current.base_url },
      {
        label: "Models",
        value:
          current.models.length === 0
            ? "none approved"
            : current.models.map(modelSummary).join("; "),
      },
    ];
  }
  return Object.entries(metadata).map(([label, value]) => ({
    label,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}
