import { describe, expect, it } from "vitest";

import type {
  CredentialPlatformEntry,
  InstanceCredentialCopy,
  WorkerBindingRecord,
  WorkerInstanceDetail,
} from "@/api/types";
import {
  bindingRowsOf,
  credentialRowsOf,
  isKeyedInstance,
  isUnlistedInstance,
} from "./use-instance-page";

const DETAIL: WorkerInstanceDetail = {
  id: "worker_instance_1",
  name: "mac-studio",
  worker: "coder@1",
  placement: "worker",
  revision: 1,
  public_key: "k",
  fingerprint: "SHA256:f",
  created_at: 1,
  ended_at: null,
  connection: null,
  bindings: [{ project_id: "prj-a", binding: "mac-main" }],
  registrations: [
    {
      runtime_identity: "worker_registration_1",
      project_id: "prj-b",
      resource_identity: "worker:kanthord:old-main",
      worker_name: "coder@1",
      host: "kanthord",
      placement: "worker",
      instance: "mac-studio",
      activity: "idle",
      draining: false,
      registered: true,
    },
  ],
  credentials: [],
};

const OLD_MAIN: WorkerBindingRecord = {
  id: "binding_old",
  project_id: "prj-b",
  name: "old-main",
  kind: "worker",
  resource_identity: "worker:kanthord:old-main",
  revision: 2,
  config: { worker: "coder@1", worker_instances: [] },
  created_at: 1,
  removed_at: null,
};

describe("bindingRowsOf", () => {
  it("marks a listing binding serving and a binding with only a live registration draining", () => {
    expect(
      bindingRowsOf(DETAIL, {
        projects: [
          {
            id: "prj-a",
            name: "kanthord",
            binding_set_version: 1,
            created_at: 1,
            paused_at: null,
            workspace_directory: "/a",
          },
          {
            id: "prj-b",
            name: "atlas",
            binding_set_version: 1,
            created_at: 1,
            paused_at: null,
            workspace_directory: "/b",
          },
        ],
        workerBindings: [OLD_MAIN],
      }),
    ).toEqual([
      { projectId: "prj-a", projectName: "kanthord", binding: "mac-main", state: "serving" },
      { projectId: "prj-b", projectName: "atlas", binding: "old-main", state: "draining" },
    ]);
  });
});

const ROUTER_ENTRY: CredentialPlatformEntry = {
  platform: "openai-compatible",
  secret_shape: "api_key",
  login_modes: [],
  metadata_fields: ["base_url"],
  verifiable: true,
};

const ROUTER_COPY: InstanceCredentialCopy = {
  name: "atlas-router",
  revision: 2,
  platform: "openai-compatible",
  sealed_current: true,
  health: {
    status: "unhealthy",
    capability: "model-list read",
    failure_reason: "rate_limited",
    models: [{ id: "qwen3-coder", owned_by: null, created: null }],
    reported_at: 7,
  },
};

describe("credentialRowsOf", () => {
  it("derives the health line, the reported model ids and the models edit of a copy", () => {
    expect(credentialRowsOf([ROUTER_COPY], [ROUTER_ENTRY])).toEqual([
      {
        copy: ROUTER_COPY,
        entry: ROUTER_ENTRY,
        shape: "api_key",
        health: {
          label: "Unhealthy",
          variant: "destructive",
          hint: "The provider limited the requests. Wait some minutes, or check the quota of the plan. The instance checks the copy again after the next copy write.",
          reportedAt: 7,
        },
        reportedModelIds: ["qwen3-coder"],
        modelsEditable: true,
      },
    ]);
  });

  it("gives an unreported copy no hint and a copy sealed to an ended key no health line", () => {
    const unreported: InstanceCredentialCopy = {
      ...ROUTER_COPY,
      health: {
        status: "unknown",
        capability: "model-list read",
        failure_reason: "held_by_instance",
        models: null,
        reported_at: null,
      },
    };
    const [fresh, stale] = credentialRowsOf(
      [unreported, { ...unreported, sealed_current: false }],
      [ROUTER_ENTRY],
    );
    expect(fresh?.health).toEqual({
      label: "Unknown",
      variant: "outline",
      hint: null,
      reportedAt: null,
    });
    expect(fresh?.reportedModelIds).toEqual([]);
    expect(stale?.health).toBeNull();
    expect(stale?.modelsEditable).toBe(false);
  });

  it("offers no models edit while the platform list is not read", () => {
    expect(credentialRowsOf([ROUTER_COPY], null)[0]?.modelsEditable).toBe(false);
  });
});

describe("the placement of an instance", () => {
  it("keys only the worker placement", () => {
    expect(isKeyedInstance(DETAIL)).toBe(true);
    expect(isKeyedInstance({ ...DETAIL, placement: "server" })).toBe(false);
    expect(isKeyedInstance({ ...DETAIL, placement: "container" })).toBe(false);
  });

  it("marks only a server instance that no binding lists", () => {
    const server: WorkerInstanceDetail = { ...DETAIL, placement: "server", bindings: [] };
    expect(isUnlistedInstance(server)).toBe(true);
    expect(isUnlistedInstance({ ...server, bindings: DETAIL.bindings })).toBe(false);
    expect(isUnlistedInstance({ ...DETAIL, bindings: [] })).toBe(false);
  });

  it("marks a container instance that no binding lists", () => {
    const container: WorkerInstanceDetail = { ...DETAIL, placement: "container", bindings: [] };
    expect(isUnlistedInstance(container)).toBe(true);
    expect(isUnlistedInstance({ ...container, bindings: DETAIL.bindings })).toBe(false);
  });
});
