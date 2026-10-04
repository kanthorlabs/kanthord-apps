import type { CredentialModel, CredentialPlatform } from "@/api/types";
import { OPENAI_COMPATIBLE, openAiMetadataOf } from "@/lib/credential-draft";

export interface MetadataFact {
  readonly label: string;
  readonly value: string;
}

export function modelSummary(model: CredentialModel): string {
  const parts = [model.id];
  if (model.contextWindow !== undefined) parts.push(`context ${model.contextWindow}`);
  if (model.maxTokens !== undefined) parts.push(`max tokens ${model.maxTokens}`);
  if (model.reasoningLevels !== undefined) {
    parts.push(`reasoning ${model.reasoningLevels.join(", ")}`);
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
      { label: "Base URL", value: current.baseUrl },
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
