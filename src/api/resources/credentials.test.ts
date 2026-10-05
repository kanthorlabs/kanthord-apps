import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  archiveCredential,
  createCredential,
  listCredentialPage,
  listCredentialPlatforms,
  listCredentials,
  readCredential,
  readCredentialLoginStatus,
  revokeCredentialRevision,
  rotateCredential,
  startCredentialLogin,
  submitCredentialLoginCode,
  updateCredentialMetadata,
} from "./credentials";

interface Seen {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

let server: Server | null = null;
const seen: Seen[] = [];

async function serve(status: number, answers: readonly unknown[]): Promise<void> {
  const instance = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      seen.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(answers[seen.length - 1]));
    });
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
  setConnection({ baseUrl: base, token: "jwt-1" });
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

const IDEMPOTENCY_KEY = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

const GITHUB = {
  name: "ci-github",
  platform: "github",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      revision: 1,
      metadata: null,
      createdAt: 1,
      endedAt: null,
    },
  ],
};

describe("listCredentialPage", () => {
  it("reads one page of the component with the platform filter and the cursor", async () => {
    await serve(200, [
      { items: [GITHUB], nextCursor: "c-1" },
      { items: [], nextCursor: null },
      { items: [], nextCursor: null },
      { items: [], nextCursor: null },
    ]);

    expect(await listCredentialPage("repository", "github", null)).toEqual({
      items: [GITHUB],
      nextCursor: "c-1",
    });
    await listCredentialPage("repository", null, "c-1");
    await listCredentialPage("llm", null, null, true);
    await listCredentialPage("storage", null, null, false);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/repository/credential?platform=github",
      "/api/repository/credential?cursor=c-1",
      "/api/llm/credential?includeArchived=true",
      "/api/storage/credential",
    ]);
    expect(seen[0]?.headers.authorization).toBe("Bearer jwt-1");
  });
});

describe("listCredentials", () => {
  it("reads every live credential page of one platform of the component", async () => {
    await serve(200, [
      { items: [GITHUB], nextCursor: "c-1" },
      { items: [], nextCursor: null },
    ]);

    expect(await listCredentials("repository", "github")).toEqual([GITHUB]);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/repository/credential?platform=github&limit=1000",
      "/api/repository/credential?platform=github&limit=1000&cursor=c-1",
    ]);
  });
});

describe("listCredentialPlatforms", () => {
  it("reads the flat platform list of each component", async () => {
    const answer = {
      items: [
        {
          platform: "github",
          secretShape: "api_key",
          loginModes: [],
          metadataFields: [],
          verifiable: true,
        },
      ],
    };
    await serve(200, [answer, answer, answer]);

    expect(await listCredentialPlatforms("repository")).toEqual(answer);
    await listCredentialPlatforms("llm");
    await listCredentialPlatforms("storage");
    expect(seen.map((req) => `${req.method} ${req.url}`)).toEqual([
      "GET /api/repository/credential/platform",
      "GET /api/llm/credential/platform",
      "GET /api/storage/credential/platform",
    ]);
  });
});

describe("readCredential", () => {
  it("reads the get of the component by the encoded name with its dependents", async () => {
    const answer = {
      ...GITHUB,
      bindings: [
        {
          projectId: "project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
          projectName: "atlas",
          bindingId: "binding_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
          name: "source",
        },
      ],
    };
    await serve(200, [answer]);

    expect(await readCredential("repository", "ci github")).toEqual(answer);
    expect(seen[0]?.url).toBe("/api/repository/credential/ci%20github");
  });

  it("rejects with the custody code as detail", async () => {
    await serve(404, [
      {
        error: { code: "credential.credential.not_found", message: "Not found." },
        requestId: "r1",
      },
    ]);

    await expect(readCredential("llm", "gone")).rejects.toMatchObject({
      code: "not_found",
      detail: "credential.credential.not_found",
    });
  });
});

describe("credential mutations", () => {
  it("posts the create with the body and an idempotency key", async () => {
    await serve(200, [GITHUB]);
    const body = {
      name: "ci-github",
      platform: "github",
      metadata: null,
      secret: { key: "ghp-1" },
    } as const;

    await createCredential("repository", body);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/repository/credential");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual(body);
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });

  it("posts the rotate at the expected revision", async () => {
    await serve(200, [GITHUB]);

    await rotateCredential("repository", "ci-github", {
      expectedRevision: 1,
      secret: { key: "ghp-2" },
    });
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/repository/credential/ci-github/revision");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      expectedRevision: 1,
      secret: { key: "ghp-2" },
    });
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });

  it("puts the metadata update at the expected revision", async () => {
    await serve(200, [GITHUB]);
    const metadata = { baseUrl: "https://api.openai.com/v1", models: [{ id: "gpt-5" }] };

    await updateCredentialMetadata("llm", "ci-openai", { expectedRevision: 2, metadata });
    expect(seen[0]?.method).toBe("PUT");
    expect(seen[0]?.url).toBe("/api/llm/credential/ci-openai/metadata");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ expectedRevision: 2, metadata });
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });

  it("posts the revoke without a body", async () => {
    await serve(200, [GITHUB]);

    await revokeCredentialRevision("repository", "ci-github", 3);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/repository/credential/ci-github/revision/3/revoke");
    expect(seen[0]?.body).toBe("");
    expect(seen[0]?.headers["content-type"]).toBeUndefined();
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });

  it("posts the archive without a body", async () => {
    await serve(200, [GITHUB]);

    await archiveCredential("storage", "evidence");
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/api/storage/credential/evidence/archive");
    expect(seen[0]?.body).toBe("");
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("credential login", () => {
  it("starts a session, supplies a code and reads the status on the llm paths", async () => {
    const session = {
      sessionId: "login_session_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      address: "https://github.com/login/device",
      code: "ABCD-1234",
      expiresAt: 900000,
    };
    const status = {
      sessionId: session.sessionId,
      state: "pending",
      lastMessage: null,
      failureReason: null,
    };
    await serve(200, [session, { sessionId: session.sessionId }, status]);

    expect(
      await startCredentialLogin({ platform: "github-copilot", name: "copilot", mode: "device" }),
    ).toEqual(session);
    await submitCredentialLoginCode(session.sessionId, "https://localhost/callback?code=1");
    expect(await readCredentialLoginStatus(session.sessionId)).toEqual(status);

    expect(seen.map((req) => `${req.method} ${req.url}`)).toEqual([
      "POST /api/llm/credential/login",
      `POST /api/llm/credential/login/${session.sessionId}/code`,
      `GET /api/llm/credential/login/${session.sessionId}`,
    ]);
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      platform: "github-copilot",
      name: "copilot",
      mode: "device",
    });
    expect(JSON.parse(seen[1]?.body ?? "")).toEqual({ value: "https://localhost/callback?code=1" });
    expect(seen[0]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
    expect(seen[1]?.headers["idempotency-key"]).toMatch(IDEMPOTENCY_KEY);
    expect(seen[2]?.headers["idempotency-key"]).toBeUndefined();
  });
});
