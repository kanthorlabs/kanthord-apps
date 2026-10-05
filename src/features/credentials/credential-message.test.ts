import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/errors";
import { credentialMessage } from "./credential-message";

function refusal(detail: string, details?: unknown): ApiError {
  return new ApiError("conflict", "Daemon text.", 409, detail, details);
}

describe("credentialMessage", () => {
  it("names the holder of a taken name", () => {
    expect(
      credentialMessage(
        refusal("credential.name.conflict", { id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC" }),
      ),
    ).toBe(
      "A credential with this name already exists. Choose another name. The holder is credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC.",
    );
  });

  it("lists the dependents of a model in use", () => {
    expect(
      credentialMessage(
        refusal("llm.metadata.model_in_use", {
          models: [{ model: "qwen-plus", agents: ["swe@1", "re@1"] }],
        }),
      ),
    ).toMatch(/In use: qwen-plus \(agents: swe@1, re@1\)\.$/);
  });

  it("maps the fixed custody codes", () => {
    expect(credentialMessage(refusal("credential.revision.conflict"))).toMatch(
      /^The credential changed/,
    );
    expect(credentialMessage(refusal("llm.metadata.base_url_fixed"))).toMatch(/Rotate the secret/);
    expect(credentialMessage(refusal("credential.revision.newest_live"))).toMatch(
      /cannot be revoked/,
    );
    expect(credentialMessage(refusal("credential.login.pending"))).toMatch(/pending/);
    expect(credentialMessage(refusal("credential.input.invalid"))).toMatch(/refused the secret/);
  });

  it("lists every dependent array of a credential in use", () => {
    const message = credentialMessage(
      refusal("credential.credential.in_use", {
        agentProviders: ["codex"],
        bindings: [{ id: "binding_1" }],
        inbounds: [],
      }),
    );
    expect(message).toMatch(/Dependents: agentProviders: codex; bindings: binding_1\./);
    expect(message).not.toMatch(/inbounds/);
  });

  it("names an archived credential as final", () => {
    expect(credentialMessage(refusal("credential.credential.archived"))).toMatch(/archived.*final/);
  });

  it("answers an in-use refusal without readable details", () => {
    expect(credentialMessage(refusal("credential.credential.in_use", null))).toMatch(
      /^A dependent still uses/,
    );
  });

  it("tells an unverifiable platform to save the credential first", () => {
    expect(credentialMessage(refusal("credential.check.unsupported"))).toMatch(/no check/);
  });

  it("falls back to the daemon message", () => {
    expect(credentialMessage(refusal("other.code"))).toBe("Daemon text.");
  });
});
