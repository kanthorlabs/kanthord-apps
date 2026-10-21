import { describe, expect, it } from "vitest";

import type { WorkerBindingRecord, WorkerInstanceDetail } from "@/api/types";
import { bindingRowsOf } from "./use-instance-page";

const DETAIL: WorkerInstanceDetail = {
  id: "worker_instance_1",
  name: "mac-studio",
  worker: "coder@1",
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
  config: { worker: "coder@1", placement: "worker", worker_instances: [] },
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
