import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/errors";
import { failureReasonHint } from "@/lib/failure-reason";
import { credentialMessage, instanceSharedFactsOf } from "./credential-message";

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

  it("names the nodes that a binding-set change leaves unmatched", () => {
    expect(
      credentialMessage(
        refusal("project.bindings.worker.node_unmatched", { node_ids: ["node_a", "node_b"] }),
      ),
    ).toBe(
      "The change leaves a node with no matching worker binding. Keep a binding whose worker and tags match each listed node. Nodes: node_a, node_b.",
    );
    expect(credentialMessage(refusal("project.bindings.worker.node_unmatched"))).toMatch(
      /match each listed node\.$/,
    );
  });

  it("names the agent and the reason of an invalid Binding prompt", () => {
    expect(
      credentialMessage(
        refusal("project.bindings.repository.prompt_invalid", {
          agent_name: "re@1",
          reason: "control_character",
        }),
      ),
    ).toBe("The Binding prompt of re@1 is invalid: the text holds a control character.");
    expect(credentialMessage(refusal("project.bindings.repository.prompt_invalid"))).toBe(
      "Daemon text.",
    );
  });

  it("states the reason of a refused container placement", () => {
    expect(
      credentialMessage(
        refusal("worker.instance.placement_unavailable", {
          placement: "container",
          reason: "server_in_container",
        }),
      ),
    ).toBe(
      "The container placement is not available. This server runs in a container, so it cannot start a container for the instance. Choose Server.",
    );
    expect(credentialMessage(refusal("worker.instance.placement_unavailable"))).toBe(
      "Daemon text.",
    );
  });

  it("names the instance and the binding of a shared container instance", () => {
    const shared = refusal("project.bindings.worker.instance_shared", {
      instance: "builder-1",
      listed_by: { project_id: "project_2", binding: "build-main" },
    });

    expect(credentialMessage(shared)).toBe(
      "builder-1 already serves build-main of another project. A container instance serves one binding.",
    );
    expect(instanceSharedFactsOf(shared.details)).toEqual({
      instance: "builder-1",
      binding: "build-main",
      projectId: "project_2",
    });
    expect(credentialMessage(refusal("project.bindings.worker.instance_shared"))).toBe(
      "Daemon text.",
    );
  });

  it("states the fix hint of the failure reason of an unreachable repository", () => {
    expect(
      credentialMessage(
        refusal("project.bindings.repository.ssh_unreachable", { failure_reason: "key_refused" }),
      ),
    ).toBe(
      `The server cannot read the repository. ${failureReasonHint("key_refused", "repository")}`,
    );
  });

  it("states a way out for an unreachable repository without a failure reason", () => {
    expect(credentialMessage(refusal("project.bindings.repository.ssh_unreachable"))).toBe(
      "The server cannot read the repository. Check the address and the SSH credential. Then try again.",
    );
  });

  it("states the tag rule", () => {
    expect(credentialMessage(refusal("project.bindings.worker.tags_invalid"))).toBe(
      "A tag is malformed or repeated. Use lower-case dotted tags, each at most 64 bytes, each once.",
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

  it("names every dependent of a credential in use by its own fields", () => {
    const message = credentialMessage(
      refusal("credential.credential.in_use", {
        agent_providers: [{ agent_name: "swe@1", provider_name: "codex" }],
        bindings: [{ binding_id: "binding_1", project_id: "project_1" }],
        inbounds: [],
      }),
    );
    expect(message).toMatch(
      /Dependents: agent providers: swe@1 \(provider codex\); project bindings: binding_1 of project_1\.$/,
    );
    expect(message).not.toMatch(/inbounds/);
  });

  it("names an inbound dependent by its identity", () => {
    expect(
      credentialMessage(
        refusal("credential.credential.in_use", { inbounds: [{ inbound_id: "inbound_1" }] }),
      ),
    ).toMatch(/Dependents: inbounds: inbound_1\.$/);
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

  it("points a legacy SSH credential at Rotate key", () => {
    expect(credentialMessage(refusal("repository.credential.ssh_key_legacy"))).toMatch(
      /Use Rotate key/,
    );
  });

  it("maps the host key codes and names the host and the new fingerprint", () => {
    expect(credentialMessage(refusal("repository.host_key.host_unsupported"))).toMatch(
      /no SSH host set/,
    );
    expect(
      credentialMessage(refusal("repository.host_key.scan_failed", { host: "gitlab.com" })),
    ).toBe(
      "The server cannot read the host key of gitlab.com. Check the network of the server, then try again.",
    );
    expect(
      credentialMessage(
        refusal("repository.host_key.changed", {
          host: "gitlab.com",
          fingerprint: "SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8",
        }),
      ),
    ).toBe(
      "The host key of gitlab.com changed after the scan. The host now presents SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8. Compare the fingerprint with the published one, then pin again.",
    );
    expect(credentialMessage(refusal("repository.host_key.unpinned", { host: "github.com" }))).toBe(
      "The server holds no host key for github.com. Pin the host key, then try again.",
    );
  });

  it("names Create SSH key when a generic entry names the ssh platform", () => {
    expect(credentialMessage(refusal("credential.entry.unsupported"))).toMatch(
      /An ssh credential enters through Create SSH key\.$/,
    );
  });

  it("keeps no message of the removed SSH alias codes", () => {
    for (const code of [
      "repository.credential.ssh_identity_ambiguous",
      "repository.credential.ssh_drift",
      "repository.credential.ssh_config_unreadable",
      "project.bindings.repository.ssh_host_mismatch",
    ]) {
      expect(credentialMessage(refusal(code))).toBe("Daemon text.");
    }
  });

  it("falls back to the daemon message", () => {
    expect(credentialMessage(refusal("other.code"))).toBe("Daemon text.");
  });
});
