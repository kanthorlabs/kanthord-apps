import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { ApiError } from "../errors";
import {
  acknowledgeFootprintAlert,
  cancelFootprintCleanup,
  createFootprintCleanup,
  listAllFootprintCandidates,
  listFootprintAlertPage,
  listFootprintCandidatePage,
  listFootprintCleanupPage,
  listFootprintItemPage,
  readFootprintCleanup,
  readFootprintKind,
  readFootprintSummary,
  runFootprintMeasure,
} from "./footprint";

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly idempotencyKey: string | undefined;
}

let server: Server | null = null;
const seen: Seen[] = [];

async function serve(routes: Readonly<Record<string, { status?: number; body: unknown }>>) {
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

const CLEANUP_ID = "cleanup_01J9ZQ4XKM3B6V8N2R5T7W0AB1";
const ALERT_ID = "alert_01J9ZQ4XKM3B6V8N2R5T7W0AB1";
const RECORD = { cleanup_id: CLEANUP_ID, state: "queued" };
const EMPTY_CANDIDATES = {
  items: [],
  next_cursor: null,
  total_count: 0,
  total_bytes: 0,
  bytes_estimated: false,
};

describe("footprint reads", () => {
  it("reads the summary", async () => {
    const summary = { stats: [], open_alerts: 1, unacknowledged_alerts: 1 };
    await serve({ "GET /api/footprint": { body: summary } });

    expect(await readFootprintSummary()).toEqual(summary);
  });

  it("reads one kind with the instance name in the query", async () => {
    await serve({
      "GET /api/footprint/kind/workspace?instance_name=mac-studio": {
        body: { stats: [], tables: null },
      },
    });

    expect(await readFootprintKind("workspace", "mac-studio")).toEqual({
      stats: [],
      tables: null,
    });
  });

  it("pages the candidates of an older_than rule with the age, the host, the limit and the cursor", async () => {
    await serve({
      "GET /api/footprint/kind/session/candidate?rule=older_than&instance_name=mac-studio&older_than_days=60&limit=50&cursor=c1":
        { body: EMPTY_CANDIDATES },
    });

    expect(
      await listFootprintCandidatePage(
        "session",
        { instance_name: "mac-studio", rule: { name: "older_than", older_than_days: 60 } },
        "c1",
        50,
      ),
    ).toEqual(EMPTY_CANDIDATES);
  });

  it("reads every candidate page of a rule with no age", async () => {
    await serve({
      "GET /api/footprint/kind/environment/candidate?rule=unbound&limit=1000": {
        body: EMPTY_CANDIDATES,
      },
    });

    expect(
      await listAllFootprintCandidates("environment", {
        instance_name: null,
        rule: { name: "unbound" },
      }),
    ).toEqual([]);
  });

  it("pages every item of a server kind", async () => {
    await serve({
      "GET /api/footprint/kind/database_backup/item?limit=50": {
        body: { items: [], next_cursor: null },
      },
    });

    expect(await listFootprintItemPage("database_backup", null, null, 50)).toEqual({
      items: [],
      next_cursor: null,
    });
  });

  it("reads a cleanup record, the cleanup page and the open alert page", async () => {
    await serve({
      [`GET /api/footprint/cleanup/${CLEANUP_ID}`]: { body: RECORD },
      "GET /api/footprint/cleanup?limit=20": { body: { items: [RECORD], next_cursor: null } },
      "GET /api/footprint/alert?open=true&limit=100": { body: { items: [], next_cursor: null } },
    });

    expect(await readFootprintCleanup(CLEANUP_ID)).toEqual(RECORD);
    expect((await listFootprintCleanupPage(null, null, 20)).items).toEqual([RECORD]);
    expect((await listFootprintAlertPage(true, null, 100)).items).toEqual([]);
  });
});

describe("footprint writes", () => {
  it("posts a cleanup with an idempotency key", async () => {
    const body = {
      kind: "trace",
      instance_name: null,
      rule: { name: "older_than", older_than_days: 30 },
      keys: ["0123456789abcdef0123456789abcdef"],
    } as const;
    await serve({ "POST /api/footprint/cleanup": { status: 201, body: RECORD } });

    expect(await createFootprintCleanup(body)).toEqual(RECORD);
    expect(JSON.parse(seen[0]!.body)).toEqual(body);
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("posts the cancel, the acknowledgement and the measure", async () => {
    await serve({
      [`POST /api/footprint/cleanup/${CLEANUP_ID}/cancel`]: { body: RECORD },
      [`POST /api/footprint/alert/${ALERT_ID}/acknowledge`]: { body: { alert_id: ALERT_ID } },
      "POST /api/footprint/measure": { body: { stats: [] } },
    });

    expect(await cancelFootprintCleanup(CLEANUP_ID)).toEqual(RECORD);
    expect(await acknowledgeFootprintAlert(ALERT_ID)).toEqual({ alert_id: ALERT_ID });
    expect(await runFootprintMeasure()).toEqual([]);
    expect(seen.every((request) => IDEMPOTENCY_KEY.test(request.idempotencyKey ?? ""))).toBe(true);
  });

  it("rejects with ApiError and the code of a refusal", async () => {
    await serve({
      "POST /api/footprint/cleanup": {
        status: 409,
        body: {
          error: {
            code: "footprint.instance.archived",
            message: "The worker instance is archived.",
          },
        },
      },
    });

    const failure = await createFootprintCleanup({
      kind: "workspace",
      instance_name: "old-laptop",
      rule: null,
      keys: ["node_01J9ZQ4XKM3B6V8N2R5T7W0AB1"],
    }).catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).detail).toBe("footprint.instance.archived");
  });
});
