import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  checkBinding,
  createEnvironmentSecret,
  createProject,
  listBindingAgents,
  listProjectEnvironments,
  listProjectPage,
  listProjects,
  listWorkerBindings,
  pauseProject,
  readBindingEnvironment,
  readEnvironmentSecret,
  rebuildEnvironment,
  renameProject,
  resumeProject,
  rotateEnvironmentSecret,
  verifyBinding,
  writeBindingEnvironment,
  writeBindingSet,
} from "./projects";

let server: Server | null = null;
const seen: IncomingMessage[] = [];
const bodies: string[] = [];

async function serve(pages: readonly unknown[]): Promise<string> {
  const instance = createServer((req, res) => {
    seen.push(req);
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      bodies.push(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(pages[seen.length - 1]));
    });
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
}

afterEach(async () => {
  seen.length = 0;
  bodies.length = 0;
  setConnection(null);
  const instance = server;
  server = null;
  if (instance === null) return;
  await new Promise<void>((resolve) => {
    instance.close(() => resolve());
    instance.closeAllConnections();
  });
});

const FIRST = {
  id: "prj-2",
  name: "second",
  binding_set_version: 1,
  created_at: 2,
  paused_at: null,
  workspace_directory: "/state/projects/prj-2",
};
const SECOND = {
  id: "prj-1",
  name: "first",
  binding_set_version: 3,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/projects/prj-1",
};

describe("listProjects", () => {
  it("reads every page of project.list", async () => {
    const base = await serve([
      { items: [FIRST], next_cursor: "c-1" },
      { items: [SECOND], next_cursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listProjects()).toEqual([FIRST, SECOND]);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/project?limit=1000",
      "/api/project?limit=1000&cursor=c-1",
    ]);
    expect(seen[0]?.headers.authorization).toBe("Bearer jwt-1");
  });
});

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

describe("listProjectPage", () => {
  it("reads one page at the cursor", async () => {
    const base = await serve([
      { items: [FIRST], next_cursor: "c-1" },
      { items: [SECOND], next_cursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listProjectPage(null)).toEqual({ items: [FIRST], next_cursor: "c-1" });
    expect(await listProjectPage("c-1")).toEqual({ items: [SECOND], next_cursor: null });
    expect(seen.map((req) => req.url)).toEqual(["/api/project", "/api/project?cursor=c-1"]);
  });
});

describe("createProject", () => {
  it("posts project.create with an idempotency key", async () => {
    const base = await serve([FIRST]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await createProject("second")).toEqual(FIRST);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("renameProject", () => {
  it("patches project.rename with an idempotency key", async () => {
    const base = await serve([SECOND]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await renameProject("prj-1", "first")).toEqual(SECOND);
    expect(seen[0]?.method).toBe("PATCH");
    expect(seen[0]?.url).toBe("/api/project/prj-1");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("pauseProject and resumeProject", () => {
  it("posts project.pause with an idempotency key", async () => {
    const paused = { ...SECOND, paused_at: 5 };
    const base = await serve([paused]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await pauseProject("prj-1")).toEqual(paused);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project/prj-1/pause");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });

  it("posts project.resume with an idempotency key", async () => {
    const base = await serve([SECOND]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await resumeProject("prj-1")).toEqual(SECOND);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project/prj-1/resume");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("writeBindingSet", () => {
  it("puts the whole set at the expected version with an idempotency key", async () => {
    const base = await serve([
      {
        project_id: "prj-1",
        binding_set_version: 3,
        bindings: {},
        changes: [],
        stale_pins: [],
      },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    await writeBindingSet("prj-1", 2, {});
    expect(seen[0]?.method).toBe("PUT");
    expect(seen[0]?.url).toBe("/api/project/prj-1/binding-set");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("verifyBinding", () => {
  it("posts project.binding.verify and returns address and credential health entries", async () => {
    const result = {
      address: { status: "healthy", capability: "network git read", failure_reason: null },
      credential: {
        status: "healthy",
        capability: "repository credential verify",
        failure_reason: null,
      },
    };
    const base = await serve([result]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await verifyBinding("prj-1", "binding_ABC")).toEqual(result);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project/prj-1/binding/binding_ABC/verify");
  });
});

describe("checkBinding", () => {
  it("posts project.binding.check with the entry body and returns verify-shaped health entries", async () => {
    const result = {
      address: { status: "healthy", capability: "network git read", failure_reason: null },
      ssh_credential: {
        status: "healthy",
        capability: "ssh credential verify",
        failure_reason: null,
      },
      credential: null,
    };
    const entry = {
      kind: "repository" as const,
      config: {
        available: true,
        platform: "github" as const,
        address: "git@github.com:kanthorlabs/kanthord.git",
        strategy: { base_branch: "main" },
        ssh_credential: "github-ssh",
      },
    };
    const base = await serve([result]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await checkBinding("prj-1", entry)).toEqual(result);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project/prj-1/binding/check");
    expect(seen[0]?.headers["idempotency-key"]).toBeUndefined();
  });
});

describe("listWorkerBindings", () => {
  it("asks for the worker bindings of the project and reads every page", async () => {
    const first = { id: "binding_w1", kind: "worker", name: "coder-main" };
    const second = { id: "binding_w2", kind: "worker", name: "coder-extra" };
    const base = await serve([
      { items: [first], next_cursor: "c-1" },
      { items: [second], next_cursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listWorkerBindings("prj-1")).toEqual([first, second]);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/project/prj-1/binding?limit=1000&kind=worker",
      "/api/project/prj-1/binding?limit=1000&kind=worker&cursor=c-1",
    ]);
  });
});

describe("listBindingAgents", () => {
  it("reads every page of project.agentConfiguration.list", async () => {
    const first = { agent: "swe@1", valid: true };
    const second = { agent: "re@1", valid: false };
    const base = await serve([
      { items: [first], next_cursor: "c-1" },
      { items: [second], next_cursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listBindingAgents("prj-1", "binding_w")).toEqual([first, second]);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/project/prj-1/binding/binding_w/agent?limit=1000",
      "/api/project/prj-1/binding/binding_w/agent?limit=1000&cursor=c-1",
    ]);
  });
});

describe("environment resources", () => {
  const STATE = {
    binding_id: "bnd-1",
    binding_name: "kanthord-repo",
    resource_identity: "repository:kanthord-repo",
    target: "image",
    source: "stored",
    status: "ready",
    digest: "a".repeat(64),
    tag: `localhost/kanthord-env/kanthord-repo:${"a".repeat(64)}`,
    run_started_at: null,
    step_started_at: null,
    reason: null,
    reason_started_at: null,
    failure: null,
    checks: [],
    repairs: 0,
    repairing: false,
  };

  it("lists the environment states of a project", async () => {
    const base = await serve([{ items: [STATE] }]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listProjectEnvironments("prj-1")).toEqual([STATE]);
    expect(seen[0]?.method).toBe("GET");
    expect(seen[0]?.url).toBe("/api/project/prj-1/environment");
  });

  it("posts the rebuild with an idempotency key and no body", async () => {
    const base = await serve([STATE]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await rebuildEnvironment("prj-1", "bnd-1")).toEqual(STATE);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project/prj-1/binding/bnd-1/environment/rebuild");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
    expect(bodies[0]).toBe("");
  });

  it("reads the environment of a binding", async () => {
    const result = {
      source: "repository",
      commit: "4f0184b",
      environment: { image: "x" },
      reason: null,
    };
    const base = await serve([result]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await readBindingEnvironment("prj-1", "bnd-1")).toEqual(result);
    expect(seen[0]?.method).toBe("GET");
    expect(seen[0]?.url).toBe("/api/project/prj-1/binding/bnd-1/environment");
  });

  it("puts the environment document with an idempotency key", async () => {
    const result = {
      project_id: "prj-1",
      binding_set_version: 3,
      changes: [{ kind: "revised", binding_id: "bnd-1" }],
      stale_pins: [],
    };
    const base = await serve([result]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await writeBindingEnvironment("prj-1", "bnd-1", { image: "x" })).toEqual(result);
    expect(seen[0]?.method).toBe("PUT");
    expect(seen[0]?.url).toBe("/api/project/prj-1/binding/bnd-1/environment");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
    expect(JSON.parse(bodies[0] ?? "")).toEqual({ environment: { image: "x" } });
  });

  it("encodes a path segment with a slash", async () => {
    const base = await serve([{ items: [] }, STATE, {}, {}]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    await listProjectEnvironments("a/b");
    await rebuildEnvironment("a/b", "c/d");
    await readBindingEnvironment("a/b", "c/d");
    await writeBindingEnvironment("a/b", "c/d", {});
    expect(seen.map((req) => req.url)).toEqual([
      "/api/project/a%2Fb/environment",
      "/api/project/a%2Fb/binding/c%2Fd/environment/rebuild",
      "/api/project/a%2Fb/binding/c%2Fd/environment",
      "/api/project/a%2Fb/binding/c%2Fd/environment",
    ]);
  });
});

describe("environment secret credentials", () => {
  const CREDENTIAL = {
    name: "registry-auth",
    platform: "environment_secret",
    holder: "server",
    sealed_to: null,
    sealed_current: true,
    revisions: [{ id: "rev-1", revision: 1, metadata: null, created_at: 1, ended_at: null }],
  };

  it("reads the credential by name", async () => {
    const base = await serve([CREDENTIAL]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await readEnvironmentSecret("registry-auth")).toEqual(CREDENTIAL);
    expect(seen[0]?.method).toBe("GET");
    expect(seen[0]?.url).toBe("/api/project/credential/registry-auth");
  });

  it("creates the credential with null metadata and an idempotency key", async () => {
    const base = await serve([CREDENTIAL]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    const body = {
      name: "registry-auth",
      platform: "environment_secret",
      metadata: null,
      secret: { key: "token-1" },
    } as const;
    expect(await createEnvironmentSecret(body)).toEqual(CREDENTIAL);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project/credential");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
    expect(JSON.parse(bodies[0] ?? "")).toEqual(body);
  });

  it("rotates the credential with an idempotency key", async () => {
    const base = await serve([CREDENTIAL]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    const body = { expected_revision: 1, secret: { key: "token-2" } };
    expect(await rotateEnvironmentSecret("registry-auth", body)).toEqual(CREDENTIAL);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/project/credential/registry-auth/revision");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
    expect(JSON.parse(bodies[0] ?? "")).toEqual(body);
  });

  it("encodes the name", async () => {
    const base = await serve([CREDENTIAL, CREDENTIAL]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    await readEnvironmentSecret("a/b");
    await rotateEnvironmentSecret("a/b", { expected_revision: 1, secret: { key: "k" } });
    expect(seen.map((req) => req.url)).toEqual([
      "/api/project/credential/a%2Fb",
      "/api/project/credential/a%2Fb/revision",
    ]);
  });
});
