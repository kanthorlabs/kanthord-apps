const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const GIB = 1_073_741_824;
const MIB = 1_048_576;
const KB = 1_000;
const DEFAULT_AGE_DAYS = 30;
const KEYS_MAX = 1000;
const STALE_MS = 45 * MINUTE_MS;
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const START_DELAY_MS = 3_000;
const FINISH_DELAY_MS = 20_000;

const CLEANABLE = [
  "trace",
  "database_backup",
  "environment",
  "cache_volume",
  "slot_image",
  "session",
  "workspace",
  "tool_output",
];
const INSTANCE_KINDS = ["session", "workspace", "tool_output", "log", "slot_residue"];
const KINDS = [
  "operational_database",
  "trace",
  "database_backup",
  "log",
  "environment",
  "cache_volume",
  "slot_image",
  "slot_residue",
  "intake_mirror",
  "workbench",
  "session",
  "workspace",
  "tool_output",
  "disk",
];
const KIND_RULES = {
  trace: ["older_than"],
  database_backup: ["older_than"],
  environment: ["unbound", "superseded"],
  cache_volume: ["unbound"],
  slot_image: ["superseded"],
  session: ["older_than"],
  workspace: ["node_closed"],
  tool_output: ["older_than"],
};
const DELETE_OPERATIONS = {
  trace: "tracking.trace.delete",
  database_backup: "footprint.backup.delete",
  environment: "project.environment.delete",
  cache_volume: "project.environment.cache_volume.delete",
  slot_image: "worker.slot_image.delete",
  session: "worker.instance.session.delete",
  workspace: "worker.instance.workspace.delete",
  tool_output: "worker.instance.tool_output.delete",
};

const ulidFrom = (seed) => {
  let tail = "";
  let value = seed * 7919 + 104729;
  for (let index = 0; index < 25; index += 1) {
    tail += ULID_ALPHABET[value % 32];
    value = Math.floor(value / 32) + (index + 1) * 131 + seed;
  }
  return `0${tail}`;
};

const hexFrom = (seed, length) => {
  let text = "";
  let value = seed + 1;
  while (text.length < length) {
    value = (value * 1103515245 + 12345) % 2147483648;
    text += value.toString(16).padStart(8, "0");
  }
  return text.slice(0, length);
};

const executionId = (index) => `execution_${ulidFrom(index)}`;
const isLive = (item) => item.refusal === null && !item.kept;

const item = (key, at, bytes, extra = {}) => ({
  key,
  at,
  bytes: bytes === null ? null : Math.round(bytes),
  project_id: null,
  node_id: null,
  execution_id: null,
  refusal: null,
  kept: false,
  closed: false,
  unbound: false,
  superseded: false,
  ...extra,
});

const buildItems = (now) => {
  const items = new Map();
  const put = (kind, host, list) => items.set(`${kind}|${host ?? ""}`, list);

  put(
    "trace",
    null,
    Array.from({ length: 240 }, (_, index) =>
      item(hexFrom(index, 32), now - (index % 60) * DAY_MS - index * MINUTE_MS, null, {
        execution_id: executionId(index),
        refusal: index === 0 ? "live" : null,
      }),
    ),
  );
  put("database_backup", null, [
    item("kanthord.db.bak-20260901T101500", now - 65 * DAY_MS, 48 * MIB),
    item("kanthord.db.bak-20260920T093000", now - 46 * DAY_MS, 52 * MIB),
    item("tracking.db.bak-20260915T080000", now - 51 * DAY_MS, 310 * MIB, { kept: true }),
    item("kanthord.db.bak-20261020T120000", now - 16 * DAY_MS, 55 * MIB, { kept: true }),
  ]);
  put("environment", null, [
    item(`kanthorlabs/kanthord@${hexFrom(901, 64)}`, now - 40 * DAY_MS, 2.1 * GIB, {
      superseded: true,
    }),
    item(`kanthorlabs/kanthord@${hexFrom(902, 64)}`, now - 3 * DAY_MS, 2.2 * GIB, {
      refusal: "live",
    }),
    item(`kanthorlabs/atlas@${hexFrom(903, 64)}`, now - 70 * DAY_MS, 1.4 * GIB, {
      unbound: true,
    }),
  ]);
  put("cache_volume", null, [
    item("kanthord_cache_0123456789abcdefghijklmn", now - 70 * DAY_MS, 3.4 * GIB, {
      unbound: true,
    }),
    item("kanthord_cache_abcdefghijklmn0123456789", now - 5 * DAY_MS, 1.9 * GIB, {
      refusal: "live",
    }),
  ]);
  put("slot_image", null, [
    item("localhost/kanthord-worker:0.41.0", now - 30 * DAY_MS, 900 * MIB, { superseded: true }),
    item("localhost/kanthord-worker:0.42.0", now - 2 * DAY_MS, 910 * MIB, { refusal: "live" }),
  ]);
  put(
    "workspace",
    "mac-studio",
    Array.from({ length: 700 }, (_, index) =>
      item(`node_${ulidFrom(5000 + index)}`, now - (index % 40) * DAY_MS, 344 * MIB, {
        node_id: `node_${ulidFrom(5000 + index)}`,
        closed: index >= 60,
        refusal: index < 3 ? "live" : null,
      }),
    ),
  );
  put(
    "session",
    "mac-studio",
    Array.from({ length: 160 }, (_, index) =>
      item(executionId(index), now - (index % 60) * DAY_MS - index * MINUTE_MS, 135 * KB, {
        execution_id: executionId(index),
      }),
    ),
  );
  put(
    "session",
    "coder-1",
    Array.from({ length: 80 }, (_, index) =>
      item(executionId(160 + index), now - ((160 + index) % 60) * DAY_MS, 135 * KB, {
        execution_id: executionId(160 + index),
      }),
    ),
  );
  put(
    "tool_output",
    "mac-studio",
    Array.from({ length: 24 }, (_, index) =>
      item(`pi-bash-${hexFrom(7000 + index, 16)}.log`, now - index * 3 * DAY_MS, 64 * KB),
    ),
  );
  put(
    "workspace",
    "build-01",
    Array.from({ length: 12 }, (_, index) =>
      item(`node_${ulidFrom(9000 + index)}`, now - (index + 10) * DAY_MS, 300 * MIB, {
        node_id: `node_${ulidFrom(9000 + index)}`,
        closed: true,
      }),
    ),
  );
  return items;
};

const matches = (entry, rule, days, now) => {
  if (!isLive(entry)) return false;
  if (rule === "older_than") return entry.at < now - days * DAY_MS;
  if (rule === "node_closed") return entry.closed;
  if (rule === "unbound") return entry.unbound;
  if (rule === "superseded") return entry.superseded;
  return false;
};

const publicItem = (entry) => ({
  key: entry.key,
  at: entry.at,
  bytes: entry.bytes,
  project_id: entry.project_id,
  node_id: entry.node_id,
  execution_id: entry.execution_id,
  refusal: entry.refusal,
  kept: entry.kept,
});

export function registerFootprint({ on, json, envelope, page, username, instancePlacement }) {
  const now = Date.now();
  const items = buildItems(now);
  const cleanups = [];
  const alerts = [
    {
      alert_id: `alert_${ulidFrom(1)}`,
      kind: "disk",
      instance_name: "mac-studio",
      item_key: "16777231",
      threshold: { measure: "days_to_floor", value: 30, free_ratio: 0.1 },
      value: 26.7,
      fired_at: now - 20 * MINUTE_MS,
      resolved_at: null,
      acknowledged_by: null,
      acknowledged_at: null,
      acknowledged_until: null,
      state: "firing",
    },
  ];
  let serverMeasuredAt = now - 6 * MINUTE_MS;
  let sequence = 100;

  const itemsOf = (kind, host) => items.get(`${kind}|${host ?? ""}`) ?? [];

  const traceBytes = 47 * MIB;

  const baseStat = (kind, host, fields) => {
    const cleanable = CLEANABLE.includes(kind);
    const measuredAt = INSTANCE_KINDS.includes(kind)
      ? host === "build-01"
        ? now - 47 * MINUTE_MS
        : now - 4 * MINUTE_MS
      : serverMeasuredAt;
    return {
      kind,
      instance_name: host,
      item_key: null,
      instance_names: [],
      measured_at: measuredAt,
      stale: Date.now() - measuredAt > STALE_MS,
      measure_error: null,
      count: null,
      bytes: null,
      wal_bytes: null,
      free_bytes: null,
      total_bytes: null,
      oldest_at: null,
      newest_at: null,
      growth_per_day: null,
      days_to_floor: null,
      thresholds: [],
      alert: { state: "ok", alert_id: null },
      delete_operation: cleanable ? DELETE_OPERATIONS[kind] : null,
      rules: cleanable ? KIND_RULES[kind] : [],
      candidates: null,
      ...fields,
    };
  };

  const defaultRule = (kind) => {
    const name = KIND_RULES[kind][0];
    return name === "older_than" ? { name, older_than_days: DEFAULT_AGE_DAYS } : { name };
  };

  const itemStat = (kind, host, fields = {}) => {
    const list = itemsOf(kind, host);
    const times = list.map((entry) => entry.at);
    const known = list.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);
    const bytes = kind === "trace" ? traceBytes : known;
    const recent = list.filter((entry) => entry.at >= Date.now() - DEFAULT_AGE_DAYS * DAY_MS);
    const rule = defaultRule(kind);
    const selected = list.filter((entry) =>
      matches(entry, rule.name, rule.older_than_days, Date.now()),
    );
    const average = list.length === 0 ? 0 : bytes / list.length;
    return baseStat(kind, host, {
      count: list.length,
      bytes,
      oldest_at: times.length === 0 ? null : Math.min(...times),
      newest_at: times.length === 0 ? null : Math.max(...times),
      growth_per_day: {
        count: recent.length / DEFAULT_AGE_DAYS,
        bytes: (recent.length * average) / DEFAULT_AGE_DAYS,
      },
      candidates: {
        rule,
        count: selected.length,
        bytes:
          kind === "trace"
            ? Math.round(selected.length * average)
            : selected.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
        bytes_estimated: kind === "trace",
      },
      ...fields,
    });
  };

  const stats = () => [
    baseStat("operational_database", null, {
      count: 64,
      bytes: 182 * MIB,
      wal_bytes: 4 * MIB,
      free_bytes: 12 * MIB,
    }),
    itemStat("trace", null, {
      wal_bytes: 9 * MIB,
      free_bytes: 30 * MIB,
      thresholds: [{ measure: "bytes", value: 8 * GIB }],
    }),
    itemStat("database_backup", null),
    baseStat("log", null, {
      item_key: "kanthord.log",
      count: 1,
      bytes: 412 * MIB,
      thresholds: [{ measure: "bytes", value: 2 * GIB }],
    }),
    baseStat("log", "mac-studio", {
      item_key: "kanthord.log",
      count: 1,
      bytes: 88 * MIB,
      thresholds: [{ measure: "bytes", value: 2 * GIB }],
    }),
    baseStat("log", "coder-1", {
      item_key: "stderr.log",
      count: 1,
      bytes: 3 * MIB,
      thresholds: [{ measure: "bytes", value: 2 * GIB }],
    }),
    itemStat("environment", null),
    itemStat("cache_volume", null),
    itemStat("slot_image", null),
    baseStat("slot_residue", "mac-studio", { count: 1, bytes: Math.round(1.2 * GIB) }),
    baseStat("slot_residue", "coder-1", { count: 1, bytes: 640 * MIB }),
    baseStat("slot_residue", "builder-1", { count: 1, bytes: 210 * MIB }),
    baseStat("intake_mirror", null, { count: 3, bytes: Math.round(1.6 * GIB) }),
    baseStat("workbench", null, { count: 0, bytes: 0 }),
    itemStat("session", "mac-studio"),
    itemStat("session", "coder-1"),
    itemStat("workspace", "mac-studio"),
    itemStat("workspace", "build-01"),
    itemStat("tool_output", "mac-studio"),
    baseStat("disk", null, {
      item_key: "16777230",
      instance_names: ["coder-1"],
      free_bytes: 310 * GIB,
      total_bytes: 994 * GIB,
      days_to_floor: 130.5,
      thresholds: [
        { measure: "free_ratio", value: 0.1 },
        { measure: "days_to_floor", value: 30, free_ratio: 0.1 },
      ],
    }),
    baseStat("disk", null, {
      item_key: "container_runtime",
      instance_names: ["builder-1"],
      measure_error: {
        code: "runtime_store_unmeasured",
        message: "Docker Desktop keeps the runtime store inside its VM.",
      },
      thresholds: [
        { measure: "free_ratio", value: 0.1 },
        { measure: "days_to_floor", value: 30, free_ratio: 0.1 },
      ],
    }),
    baseStat("disk", "mac-studio", {
      item_key: "16777231",
      instance_names: ["mac-studio"],
      measured_at: now - 4 * MINUTE_MS,
      stale: false,
      free_bytes: 260 * GIB,
      total_bytes: 1024 * GIB,
      days_to_floor: 26.7,
      thresholds: [
        { measure: "free_ratio", value: 0.1 },
        { measure: "days_to_floor", value: 30, free_ratio: 0.1 },
      ],
      alert: { state: "firing", alert_id: alerts[0].alert_id },
    }),
  ];

  const validation = (res, field) =>
    envelope(res, 400, "gateway.request.validation_failed", "Request validation failed.", [
      { path: field, code: "custom" },
    ]);

  const checkHost = (res, kind, instanceName) => {
    const instanceKind = INSTANCE_KINDS.includes(kind);
    if (instanceKind !== (instanceName !== null)) {
      envelope(
        res,
        409,
        "footprint.kind.host_mismatch",
        "A server kind takes no instance name, and an instance kind requires one.",
      );
      return false;
    }
    if (instanceName !== null && instancePlacement(instanceName) === null) {
      envelope(res, 404, "footprint.instance.not_found", "No worker instance has the name.");
      return false;
    }
    return true;
  };

  const unacknowledged = () =>
    alerts.filter((alert) => alert.resolved_at === null && alert.acknowledged_at === null).length;

  on("GET", /^\/api\/footprint$/, (_m, _b, res) =>
    json(res, 200, {
      stats: stats(),
      open_alerts: alerts.filter((alert) => alert.resolved_at === null).length,
      unacknowledged_alerts: unacknowledged(),
    }),
  );

  on("POST", /^\/api\/footprint\/measure$/, (_m, _b, res) => {
    serverMeasuredAt = Date.now();
    json(res, 200, { stats: stats().filter((stat) => stat.instance_name === null) });
  });

  on("GET", /^\/api\/footprint\/kind\/([^/]+)$/, (m, _b, res, _t, url) => {
    const kind = decodeURIComponent(m[1]);
    if (!KINDS.includes(kind)) return validation(res, ["params", "kind"]);
    const instanceName = url.searchParams.get("instance_name");
    json(res, 200, {
      stats: stats().filter(
        (stat) =>
          stat.kind === kind && (instanceName === null || stat.instance_name === instanceName),
      ),
      tables:
        kind === "trace"
          ? [
              {
                name: "tracking_trace",
                bytes: 2 * MIB,
                oldest_at: now - 59 * DAY_MS,
                delete_operation: null,
              },
              { name: "tracking_span", bytes: 31 * MIB, oldest_at: null, delete_operation: null },
              {
                name: "tracking_session_entry",
                bytes: 12 * MIB,
                oldest_at: null,
                delete_operation: null,
              },
              {
                name: "rollup",
                bytes: 1 * MIB,
                oldest_at: now - 80 * DAY_MS,
                delete_operation: null,
              },
            ]
          : kind === "operational_database"
            ? [
                {
                  name: "mission_evidence",
                  bytes: 64 * MIB,
                  oldest_at: null,
                  delete_operation: "mission.evidence.delete",
                },
                {
                  name: "intake_inbound_event",
                  bytes: 22 * MIB,
                  oldest_at: now - 41 * DAY_MS,
                  delete_operation: "intake.inbound.event.delete",
                },
                {
                  name: "intake_outbound_request",
                  bytes: 5 * MIB,
                  oldest_at: null,
                  delete_operation: "intake.outbound.request.delete",
                },
                {
                  name: "scheduler_execution",
                  bytes: 18 * MIB,
                  oldest_at: null,
                  delete_operation: null,
                },
                {
                  name: "footprint_cleanup",
                  bytes: 64 * KB,
                  oldest_at: null,
                  delete_operation: null,
                },
                {
                  name: "footprint_alert",
                  bytes: 16 * KB,
                  oldest_at: null,
                  delete_operation: null,
                },
              ]
            : null,
    });
  });

  const listRoute = (suffix, select) =>
    on("GET", new RegExp(`^/api/footprint/kind/([^/]+)/${suffix}$`), (m, _b, res, _t, url) => {
      const kind = decodeURIComponent(m[1]);
      if (!CLEANABLE.includes(kind)) return validation(res, ["params", "kind"]);
      const instanceName = url.searchParams.get("instance_name");
      if (!checkHost(res, kind, instanceName)) return;
      const list = [...itemsOf(kind, instanceName)].sort((a, b) => a.at - b.at);
      select(res, url, kind, list);
    });

  listRoute("candidate", (res, url, kind, list) => {
    const rule = url.searchParams.get("rule") ?? KIND_RULES[kind][0];
    if (!KIND_RULES[kind].includes(rule)) {
      return envelope(
        res,
        409,
        "footprint.rule.not_supported",
        "The rule does not apply to the kind.",
      );
    }
    const days = Number(url.searchParams.get("older_than_days") ?? DEFAULT_AGE_DAYS);
    const selected = list.filter((entry) => matches(entry, rule, days, Date.now()));
    const average = kind === "trace" && list.length > 0 ? traceBytes / list.length : null;
    json(res, 200, {
      ...page(selected.map(publicItem), url),
      total_count: selected.length,
      total_bytes:
        average === null
          ? selected.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0)
          : Math.round(selected.length * average),
      bytes_estimated: kind === "trace",
    });
  });

  listRoute("item", (res, url, _kind, list) => json(res, 200, page(list.map(publicItem), url)));

  const outcomeOf = (record) =>
    record.outcome === null
      ? null
      : {
          ...record.outcome,
          pending:
            record.keys.length -
            record.outcome.removed -
            record.outcome.absent -
            record.outcome.refused.length,
        };

  const view = (record) => ({ ...record, outcome: outcomeOf(record) });

  const run = (record) => {
    setTimeout(() => {
      if (record.state !== "queued") return;
      if (INSTANCE_KINDS.includes(record.kind)) {
        record.state = "failed";
        record.finished_at = Date.now();
        return;
      }
      record.state = "running";
      record.outcome = { removed: 0, removed_bytes: 0, absent: 0, refused: [] };
      setTimeout(() => {
        const key = `${record.kind}|${record.instance_name ?? ""}`;
        const list = items.get(key) ?? [];
        const doomed = new Set(record.keys);
        const removed = list.filter((entry) => doomed.has(entry.key) && isLive(entry));
        items.set(
          key,
          list.filter((entry) => !removed.includes(entry)),
        );
        record.state = "completed";
        record.finished_at = Date.now();
        record.outcome = {
          removed: removed.length,
          removed_bytes:
            record.kind === "trace"
              ? null
              : removed.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
          absent: record.keys.length - removed.length,
          refused: [],
        };
      }, FINISH_DELAY_MS);
    }, START_DELAY_MS);
  };

  on("POST", /^\/api\/footprint\/cleanup$/, (_m, body, res) => {
    if (!CLEANABLE.includes(body?.kind)) return validation(res, ["body", "kind"]);
    const keys = body.keys;
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > KEYS_MAX) {
      return validation(res, ["body", "keys"]);
    }
    if (new Set(keys).size !== keys.length) return validation(res, ["body", "keys"]);
    const instanceName = body.instance_name ?? null;
    if (!checkHost(res, body.kind, instanceName)) return;
    if (body.rule !== null && !KIND_RULES[body.kind].includes(body.rule?.name)) {
      return envelope(
        res,
        409,
        "footprint.rule.not_supported",
        "The rule does not apply to the kind.",
      );
    }
    sequence += 1;
    const record = {
      cleanup_id: `cleanup_${ulidFrom(sequence)}`,
      kind: body.kind,
      instance_name: instanceName,
      rule: body.rule,
      keys,
      requested_by: { kind: "human", account: username, name: username },
      requested_at: Date.now(),
      state: "queued",
      finished_at: null,
      outcome: null,
    };
    cleanups.unshift(record);
    run(record);
    json(res, 201, view(record));
  });

  const findCleanup = (res, id) => {
    const record = cleanups.find((entry) => entry.cleanup_id === id);
    if (record === undefined) {
      envelope(res, 404, "footprint.cleanup.not_found", "No cleanup has the id.");
    }
    return record;
  };

  on("GET", /^\/api\/footprint\/cleanup$/, (_m, _b, res, _t, url) => {
    const kind = url.searchParams.get("kind");
    json(
      res,
      200,
      page(cleanups.filter((record) => kind === null || record.kind === kind).map(view), url),
    );
  });

  on("GET", /^\/api\/footprint\/cleanup\/([^/]+)$/, (m, _b, res) => {
    const record = findCleanup(res, decodeURIComponent(m[1]));
    if (record !== undefined) json(res, 200, view(record));
  });

  on("POST", /^\/api\/footprint\/cleanup\/([^/]+)\/cancel$/, (m, _b, res) => {
    const record = findCleanup(res, decodeURIComponent(m[1]));
    if (record === undefined) return;
    if (record.state !== "queued") {
      return envelope(res, 409, "footprint.cleanup.not_queued", "The cleanup is not queued.");
    }
    record.state = "cancelled";
    record.finished_at = Date.now();
    json(res, 200, view(record));
  });

  on("GET", /^\/api\/footprint\/alert$/, (_m, _b, res, _t, url) => {
    const open = url.searchParams.get("open");
    json(
      res,
      200,
      page(
        alerts.filter(
          (alert) => open === null || (open === "true") === (alert.resolved_at === null),
        ),
        url,
      ),
    );
  });

  on("POST", /^\/api\/footprint\/alert\/([^/]+)\/acknowledge$/, (m, _b, res) => {
    const alert = alerts.find((entry) => entry.alert_id === decodeURIComponent(m[1]));
    if (alert === undefined) {
      return envelope(res, 404, "footprint.alert.not_found", "No alert has the id.");
    }
    if (alert.resolved_at !== null) {
      return envelope(res, 409, "footprint.alert.resolved", "The episode is resolved.");
    }
    if (alert.acknowledged_at !== null) {
      return envelope(res, 409, "footprint.alert.acknowledged", "The acknowledgement holds.");
    }
    alert.acknowledged_by = { kind: "human", account: username, name: username };
    alert.acknowledged_at = Date.now();
    alert.acknowledged_until = 130 * GIB;
    json(res, 200, alert);
  });
}
