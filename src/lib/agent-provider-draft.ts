import {
  AGENT_PROVIDER_KINDS,
  type AgentEnablement,
  type AgentProviderAddBody,
  type AgentProviderKind,
  type Credential,
} from "@/api/types";

export interface AgentProviderDraft {
  readonly name: string;
  readonly credential: string;
}

export type AgentProviderErrors = Partial<Record<keyof AgentProviderDraft, string>>;

export const EMPTY_AGENT_PROVIDER: AgentProviderDraft = { name: "", credential: "" };

export function agentProviderCredentials(
  credentials: readonly Credential[],
): readonly Credential[] {
  return credentials.filter((credential) =>
    AGENT_PROVIDER_KINDS.some((kind) => kind === credential.platform),
  );
}

export function unusedProviderCredentials(
  credentials: readonly Credential[],
  enablement: AgentEnablement,
): readonly Credential[] {
  return agentProviderCredentials(credentials).filter(
    (credential) =>
      !enablement.agent_providers.some((provider) => provider.credential === credential.name),
  );
}

export function providerOfCredential(
  credentials: readonly Credential[],
  credentialName: string,
): AgentProviderKind | null {
  const platform = credentials.find((credential) => credential.name === credentialName)?.platform;
  return AGENT_PROVIDER_KINDS.find((kind) => kind === platform) ?? null;
}

export function missingAgentProviderFields(draft: AgentProviderDraft): readonly string[] {
  return [
    ...(draft.name.trim() === "" ? ["Name"] : []),
    ...(draft.credential === "" ? ["LLM credential"] : []),
  ];
}

export function agentProviderBodyOf(
  draft: AgentProviderDraft,
  enablement: AgentEnablement,
  credentials: readonly Credential[],
):
  | { readonly ok: true; readonly body: AgentProviderAddBody }
  | { readonly ok: false; readonly errors: AgentProviderErrors } {
  const name = draft.name.trim();
  const provider = providerOfCredential(credentials, draft.credential);
  const errors: AgentProviderErrors = {
    ...(name === "" ? { name: "Fill Name." } : {}),
    ...(enablement.agent_providers.some((existing) => existing.name === name)
      ? { name: `The name ${name} is taken in this enablement. Choose another name.` }
      : {}),
    ...(provider === null ? { credential: "Choose a credential." } : {}),
  };
  if (Object.keys(errors).length > 0 || provider === null) return { ok: false, errors };
  return {
    ok: true,
    body: {
      expected_revision: enablement.revision,
      name,
      provider,
      credential: draft.credential,
    },
  };
}

export function providerRemovalBlock(
  enablement: AgentEnablement,
  providerName: string,
): string | null {
  if (enablement.agent_providers.length <= 1)
    return "An enablement keeps at least one agent provider. Add another agent provider first.";
  if (enablement.default_configuration.agent_provider === providerName)
    return `The default configuration names ${providerName}. Change the default configuration first.`;
  return null;
}
