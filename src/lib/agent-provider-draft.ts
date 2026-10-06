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

export function providerCredentials(credentials: readonly Credential[]): readonly Credential[] {
  return credentials.filter((credential) =>
    AGENT_PROVIDER_KINDS.some((kind) => kind === credential.platform),
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
    ...(draft.credential === "" ? ["Credential"] : []),
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
    ...(enablement.agentProviders.some((existing) => existing.name === name)
      ? { name: `The name ${name} is taken in this enablement. Choose another name.` }
      : {}),
    ...(provider === null ? { credential: "Choose a credential." } : {}),
  };
  if (Object.keys(errors).length > 0 || provider === null) return { ok: false, errors };
  return {
    ok: true,
    body: {
      expectedRevision: enablement.revision,
      name,
      provider,
      credential: draft.credential,
    },
  };
}
