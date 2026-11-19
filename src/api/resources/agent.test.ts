import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { ApiError } from "../errors";
import {
  createAgentVariant,
  deleteAgentVariant,
  listAgentVariants,
  readAgentVariant,
  readAgentVariantPrompt,
  updateAgentVariant,
} from "./agent";

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly idempotencyKey: string | undefined;
}

interface Route {
  readonly status?: number;
  readonly body: unknown;
}

let server: Server | null = null;
const seen: Seen[] = [];

async function serve(routes: Readonly<Record<string, Route>>): Promise<void> {
  const instance = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const method = req.method ?? "GET";
      const url = req.url ?? "";
      const header = req.headers["idempotency-key"];
      seen.push({
        method,
        url,
        body,
        idempotencyKey: typeof header === "string" ? header : undefined,
      });
      const route = routes[`${method} ${url}`];
      res.writeHead(route === undefined ? 404 : (route.status ?? 200), {
        "content-type": "application/json",
      });
      res.end(JSON.stringify(route?.body ?? { error: { code: "gateway.routing.not_found" } }));
    });
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  setConnection({
    baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
    token: "jwt-1",
  });
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

const VARIANT_ID = "agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0VA1";
const VARIANT_PATH = `/api/agent/variant/${VARIANT_ID}`;
const ITEM = {
  id: VARIANT_ID,
  agent_name: "swe@1",
  display_name: "Software Architecture",
  revision: 1,
};
const VARIANT = { ...ITEM, instruction: "Weigh each change against the structure." };

describe("listAgentVariants", () => {
  it("gets the items of the variant list", async () => {
    await serve({ "GET /api/agent/variant": { body: { items: [ITEM] } } });

    expect(await listAgentVariants()).toEqual([ITEM]);
    expect(seen.map((call) => call.method)).toEqual(["GET"]);
  });
});

describe("readAgentVariant", () => {
  it("gets the variant by its identity", async () => {
    await serve({ [`GET ${VARIANT_PATH}`]: { body: VARIANT } });

    expect(await readAgentVariant(VARIANT_ID)).toEqual(VARIANT);
  });

  it("encodes the path segment", async () => {
    await serve({});

    await expect(readAgentVariant("a/b c")).rejects.toBeInstanceOf(ApiError);
    expect(seen[0]!.url).toBe("/api/agent/variant/a%2Fb%20c");
  });
});

describe("createAgentVariant", () => {
  it("posts the body with an idempotency key", async () => {
    await serve({ "POST /api/agent/variant": { body: VARIANT } });
    const body = {
      agent_name: "swe@1",
      display_name: "Software Architecture",
      instruction: "Weigh each change against the structure.",
    };

    expect(await createAgentVariant(body)).toEqual(VARIANT);
    expect(JSON.parse(seen[0]!.body)).toEqual(body);
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("keeps the code and the details of an error answer", async () => {
    const details = [{ path: ["body", "instruction"], code: "custom" }];
    await serve({
      "POST /api/agent/variant": {
        status: 400,
        body: {
          error: {
            code: "gateway.request.validation_failed",
            message: "Request validation failed.",
            details,
          },
        },
      },
    });

    const error = await createAgentVariant({
      agent_name: "swe@1",
      display_name: "Name",
      instruction: " ",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).detail).toBe("gateway.request.validation_failed");
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).details).toEqual(details);
  });
});

describe("updateAgentVariant", () => {
  it("puts the body with an idempotency key", async () => {
    await serve({ [`PUT ${VARIANT_PATH}`]: { body: { ...VARIANT, revision: 2 } } });
    const body = { display_name: "Architecture", instruction: "Text.", expected_revision: 1 };

    expect(await updateAgentVariant(VARIANT_ID, body)).toEqual({ ...VARIANT, revision: 2 });
    expect(JSON.parse(seen[0]!.body)).toEqual(body);
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("keeps the current row of a revision conflict", async () => {
    await serve({
      [`PUT ${VARIANT_PATH}`]: {
        status: 409,
        body: {
          error: {
            code: "agent.variant.revision_conflict",
            message: "The variant changed.",
            details: { current: { ...VARIANT, revision: 3 } },
          },
        },
      },
    });

    const error = await updateAgentVariant(VARIANT_ID, {
      display_name: "Architecture",
      instruction: "Text.",
      expected_revision: 1,
    }).catch((caught: unknown) => caught);

    expect((error as ApiError).detail).toBe("agent.variant.revision_conflict");
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).details).toEqual({ current: { ...VARIANT, revision: 3 } });
  });
});

describe("deleteAgentVariant", () => {
  it("deletes with the expected revision in the body", async () => {
    await serve({ [`DELETE ${VARIANT_PATH}`]: { body: {} } });

    await deleteAgentVariant(VARIANT_ID, 2);

    expect(seen[0]!.method).toBe("DELETE");
    expect(JSON.parse(seen[0]!.body)).toEqual({ expected_revision: 2 });
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("keeps the code of an in-use refusal", async () => {
    await serve({
      [`DELETE ${VARIANT_PATH}`]: {
        status: 409,
        body: { error: { code: "agent.variant.in_use", message: "In use.", details: null } },
      },
    });

    const error = await deleteAgentVariant(VARIANT_ID, 1).catch((caught: unknown) => caught);

    expect((error as ApiError).detail).toBe("agent.variant.in_use");
  });
});

describe("readAgentVariantPrompt", () => {
  it("gets the agent declaration with the variant identity in the query", async () => {
    const declaration = { agent_name: "swe@1", prompt: { parts: [], final: null } };
    await serve({ [`GET /api/agent/swe%401?variant_id=${VARIANT_ID}`]: { body: declaration } });

    expect(await readAgentVariantPrompt("swe@1", VARIANT_ID)).toEqual(declaration);
  });
});
