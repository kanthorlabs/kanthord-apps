import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  checkBinding,
  createProject,
  listProjectPage,
  listProjects,
  renameProject,
  verifyBinding,
  writeBindingSet,
} from "./projects";

let server: Server | null = null;
const seen: IncomingMessage[] = [];

async function serve(pages: readonly unknown[]): Promise<string> {
  const instance = createServer((req, res) => {
    seen.push(req);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(pages[seen.length - 1]));
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
}

afterEach(async () => {
  seen.length = 0;
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
  bindingSetVersion: 1,
  createdAt: 2,
  workspaceDirectory: "/state/projects/prj-2",
};
const SECOND = {
  id: "prj-1",
  name: "first",
  bindingSetVersion: 3,
  createdAt: 1,
  workspaceDirectory: "/state/projects/prj-1",
};

describe("listProjects", () => {
  it("reads every page of project.list", async () => {
    const base = await serve([
      { items: [FIRST], nextCursor: "c-1" },
      { items: [SECOND], nextCursor: null },
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

const IDEMPOTENCY_KEY = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

describe("listProjectPage", () => {
  it("reads one page at the cursor", async () => {
    const base = await serve([
      { items: [FIRST], nextCursor: "c-1" },
      { items: [SECOND], nextCursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listProjectPage(null)).toEqual({ items: [FIRST], nextCursor: "c-1" });
    expect(await listProjectPage("c-1")).toEqual({ items: [SECOND], nextCursor: null });
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

describe("writeBindingSet", () => {
  it("puts the whole set at the expected version with an idempotency key", async () => {
    const base = await serve([
      { projectId: "prj-1", bindingSetVersion: 3, bindings: {}, changes: [] },
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
      address: { status: "healthy", capability: "network git read" },
      credential: { status: "healthy", capability: "repository credential verify" },
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
      address: { status: "healthy", capability: "network git read" },
      sshCredential: { status: "healthy", capability: "ssh credential verify" },
      credential: null,
    };
    const entry = {
      kind: "repository" as const,
      config: {
        available: true,
        platform: "github" as const,
        address: "git@github.com:kanthorlabs/kanthord.git",
        strategy: { baseBranch: "main" },
        sshCredential: "github-ssh",
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
