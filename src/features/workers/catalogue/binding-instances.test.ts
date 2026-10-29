import { describe, expect, it } from "vitest";

import type { WorkerBindingRecord, WorkerCatalogItem, WorkerRegistrationRecord } from "@/api/types";
import { bindingInstances } from "./binding-instances";

const CATALOG: readonly WorkerCatalogItem[] = [
  { name: "coder@1", host: "kanthord", declared_node_states: [], declared_intents: [] },
];

function binding(config: WorkerBindingRecord["config"]): WorkerBindingRecord {
  return {
    id: "binding_1",
    project_id: "prj",
    name: "mac-main",
    kind: "worker",
    resource_identity: "worker:mac-main",
    revision: 1,
    config,
    created_at: 1,
    removed_at: null,
  };
}

function registration(instance: string | null): WorkerRegistrationRecord {
  return {
    runtime_identity: `worker_registration_${instance ?? "none"}`,
    project_id: "prj",
    resource_identity: "worker:mac-main",
    worker_name: "coder@1",
    host: "kanthord",
    placement: "worker",
    instance,
    activity: "idle",
    draining: false,
    registered: true,
  };
}

describe("bindingInstances", () => {
  it("names the listed instances that hold no live registration", () => {
    const [entry] = bindingInstances(
      [
        binding({
          worker: "coder@1",
          worker_instances: ["mac-studio", "build-01", "build-02"],
        }),
      ],
      [registration("build-01")],
      CATALOG,
    );
    expect(entry).toMatchObject({
      expected: 3,
      live: 1,
      missing: 2,
      unregistered: ["mac-studio", "build-02"],
      gap: "worker",
      disabled: false,
    });
  });

  it("counts the listed instances of a binding against its live registrations", () => {
    const [entry] = bindingInstances(
      [binding({ worker: "coder@1", worker_instances: ["coder-1", "box-1"] })],
      [registration("coder-1"), registration("box-1")],
      CATALOG,
    );
    expect(entry).toMatchObject({ expected: 2, live: 2, missing: 0, shortfall: false });
  });

  it("reads the instance count of an external harness and names no instance", () => {
    const [entry] = bindingInstances(
      [binding({ worker: "claude-code@1", instance_count: 2 })],
      [registration(null)],
      [
        ...CATALOG,
        {
          name: "claude-code@1",
          host: "external-harness",
          declared_node_states: [],
          declared_intents: [],
        },
      ],
    );
    expect(entry).toMatchObject({
      expected: 2,
      live: 1,
      missing: 1,
      unregistered: [],
      gap: "none",
    });
  });

  it("marks a native binding with an empty list disabled", () => {
    const [entry] = bindingInstances(
      [binding({ worker: "coder@1", worker_instances: [] })],
      [],
      CATALOG,
    );
    expect(entry).toMatchObject({ expected: 0, missing: 0, disabled: true, gap: "none" });
  });
});
