import {
  AGENT_PROVIDER_KINDS,
  type AgentEnablement,
  type AgentEnablementPutBody,
  type AgentProvider,
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
  return credentials.filter(
    (credential, index) =>
      AGENT_PROVIDER_KINDS.some((kind) => kind === credential.platform) &&
      credentials.findIndex((other) => other.name === credential.name) === index,
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

export function providerNameOfCredential(
  enablements: readonly AgentEnablement[],
  credentialName: string,
  takenNames: readonly string[] = [],
): string | null {
  for (const enablement of enablements) {
    const match = enablement.agent_providers.find(
      (provider) => provider.credential === credentialName && !takenNames.includes(provider.name),
    );
    if (match !== undefined) return match.name;
  }
  return null;
}

export function nameAfterCredentialPick(
  currentName: string,
  prefilledName: string | null,
  knownName: string | null,
): string {
  const replaceable = currentName.trim() === "" || currentName === prefilledName;
  return replaceable ? (knownName ?? "") : currentName;
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

export function credentialOfDefaultProvider(enablement: AgentEnablement): string {
  const { agent_provider } = enablement.default_configuration;
  return (
    enablement.agent_providers.find((provider) => provider.name === agent_provider)?.credential ??
    ""
  );
}

export function pinnedCredentialBodyOf(
  enablement: AgentEnablement,
  credentialName: string,
  pinnedModelIdentifier: string,
  credentials: readonly Credential[],
):
  | { readonly ok: true; readonly body: AgentEnablementPutBody }
  | { readonly ok: false; readonly errors: AgentProviderErrors } {
  const bodyOf = (
    agentProviderName: string,
    agentProviders: readonly AgentProvider[],
  ): AgentEnablementPutBody => ({
    expected_revision: enablement.revision,
    agent_providers: agentProviders,
    default_configuration: {
      agent_provider: agentProviderName,
      model_identifier: pinnedModelIdentifier,
      reasoning_effort: "off",
    },
    fallback_configurations: enablement.fallback_configurations,
  });
  const holders = enablement.agent_providers.filter(
    (provider) => provider.credential === credentialName,
  );
  const holder =
    holders.find((provider) => provider.name === enablement.default_configuration.agent_provider) ??
    holders[0];
  if (holder !== undefined)
    return { ok: true, body: bodyOf(holder.name, enablement.agent_providers) };
  const kind = providerOfCredential(credentials, credentialName);
  if (kind === null) return { ok: false, errors: { credential: "Choose a credential." } };
  if (enablement.agent_providers.some((provider) => provider.name === credentialName)) {
    return {
      ok: false,
      errors: {
        credential: `The name ${credentialName} is taken in this enablement by another credential.`,
      },
    };
  }
  const added: AgentProvider = { name: credentialName, provider: kind, credential: credentialName };
  return { ok: true, body: bodyOf(credentialName, [...enablement.agent_providers, added]) };
}

export type ProviderRemovalBlock = "last-provider" | "default-provider";

export function providerRemovalBlock(
  enablement: AgentEnablement,
  providerName: string,
): ProviderRemovalBlock | null {
  if (enablement.agent_providers.length <= 1) return "last-provider";
  if (enablement.default_configuration.agent_provider === providerName) return "default-provider";
  return null;
}
