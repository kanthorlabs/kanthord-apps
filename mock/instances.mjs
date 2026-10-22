import { createHash, randomBytes } from "node:crypto";

import * as fx from "./fixtures.mjs";

const INSTANCE_NAME = /^[a-z][a-z0-9-]{0,62}$/;
const RESERVED_NAMES = ["server", "token", "connect", "heartbeat"];
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const ulidTail = () => {
  let tail = "";
  for (let index = 0; index < 25; index += 1) {
    tail += ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)];
  }
  return tail;
};

const fingerprintOf = (publicKey) =>
  `SHA256:${createHash("sha256").update(Buffer.from(publicKey, "base64url")).digest("base64").replace(/=+$/, "")}`;

const canonicalJson = (value) =>
  JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));

const COPY_CAPABILITIES = {
  "github-copilot": "copilot token read",
  "openai-codex": "model call",
  "anthropic-subscription": "model call",
  anthropic: "model-list read",
  "openai-compatible": "model-list read",
  openrouter: "key read",
  openai: "model-list read",
  "opencode-go": "model call",
};

const unreportedHealth = (platform) => ({
  status: "unknown",
  capability: COPY_CAPABILITIES[platform] ?? "none",
  failure_reason: "held_by_instance",
  models: null,
  reported_at: null,
});

const connectionOf = (name, now) =>
  name === null
    ? null
    : { connection_name: name, connected_at: now - 40 * 60_000, last_heartbeat_at: now - 9_000 };

export function registerInstances({ on, json, envelope, page, bindingSets, credentials, agents }) {
  const now = Date.now();
  const instances = structuredClone(fx.WORKER_INSTANCES).map(({ connected, ...record }) => ({
    record,
    connection: connectionOf(connected, now),
  }));

  const refuse = (res, status, code, message, details = null) =>
    envelope(res, status, code, message, details);

  const find = (name) => instances.find((instance) => instance.record.name === name);

  const live = (instance) => instance.record.ended_at === null;

  const listsInstance = (entry, name) =>
    entry.kind === "worker" &&
    entry.config.placement === "worker" &&
    (entry.config.worker_instances ?? []).includes(name);

  const bindingsOf = (name) =>
    bindingSets().flatMap(([projectId, set]) =>
      Object.entries(set.bindings)
        .filter(([, entry]) => listsInstance(entry, name))
        .map(([binding]) => ({ project_id: projectId, binding })),
    );

  const registrationsOf = (name) =>
    fx.WORKER_REGISTRATIONS.filter((registration) => registration.instance === name);

  const healthOf = (holder, copy) => {
    const report = fx.INSTANCE_COPY_REPORTS.find(
      (item) => item.holder === holder && item.name === copy.name,
    );
    if (!copy.sealed_current || report?.revision !== copy.revision) {
      return unreportedHealth(copy.platform);
    }
    return {
      status: report.status,
      capability: report.capability,
      failure_reason: report.failure_reason,
      models: report.models,
      reported_at: report.reported_at,
    };
  };

  const copiesOf = (name) =>
    credentials
      .filter((credential) => credential.holder === name)
      .filter((credential) => credential.revisions.some((revision) => revision.ended_at === null))
      .map((credential) => ({
        name: credential.name,
        revision: credential.revisions.find((revision) => revision.ended_at === null).revision,
        platform: credential.platform,
        sealed_current: credential.sealed_current,
      }))
      .map((copy) => ({ ...copy, health: healthOf(name, copy) }));

  const listingConfigsOf = (instance) =>
    bindingSets().flatMap(([, set]) =>
      Object.values(set.bindings)
        .filter((entry) => listsInstance(entry, instance.record.name))
        .map((entry) => entry.config),
    );

  const chainCredentialsOf = (agent, entry) => {
    const enablement = agent.enablement;
    const head = entry?.agent_provider ?? enablement.default_configuration.agent_provider;
    const tail = (entry?.fallback_configurations ?? enablement.fallback_configurations).map(
      (config) => config.agent_provider,
    );
    return [head, ...tail].flatMap((providerName) => {
      const provider = enablement.agent_providers.find((item) => item.name === providerName);
      return provider === undefined ? [] : [provider.credential];
    });
  };

  const holderMismatch = (instance) => {
    const held = copiesOf(instance.record.name)
      .filter((copy) => copy.sealed_current)
      .map((copy) => copy.name);
    return listingConfigsOf(instance).some((config) =>
      agents
        .filter((agent) => agent.enablement !== null && agent.worker_names.includes(config.worker))
        .some((agent) =>
          chainCredentialsOf(
            agent,
            (config.entries ?? []).find((entry) => entry.agent === agent.agent_name),
          ).some((credential) => !held.includes(credential)),
        ),
    );
  };

  const listItem = (instance) => ({
    ...instance.record,
    connection: instance.connection,
    binding_count: bindingsOf(instance.record.name).length,
    holder_mismatch: holderMismatch(instance),
  });

  const detail = (instance) => ({
    ...instance.record,
    connection: instance.connection,
    bindings: bindingsOf(instance.record.name),
    registrations: live(instance) ? registrationsOf(instance.record.name) : [],
    credentials: copiesOf(instance.record.name),
  });

  const keyOrRefuse = (res, body) => {
    const hasKey = body?.public_key !== undefined;
    const hasEndpoint = body?.endpoint !== undefined;
    if (hasKey === hasEndpoint || (hasEndpoint && !URL.canParse(body.endpoint))) {
      refuse(
        res,
        400,
        "worker.instance.key_invalid",
        "The input holds neither or both of public_key and endpoint.",
      );
      return null;
    }
    if (hasKey) return { publicKey: body.public_key, privateKey: null };
    return {
      publicKey: randomBytes(32).toString("base64url"),
      privateKey: randomBytes(32).toString("base64url"),
    };
  };

  const writeAnswer = (res, record, endpoint, privateKey) =>
    json(res, 200, {
      ...record,
      ...(privateKey === null
        ? {}
        : {
            instance_configuration: Buffer.from(
              canonicalJson({
                name: record.name,
                endpoint,
                instance_id: record.id,
                private_key: privateKey,
              }),
              "utf8",
            ).toString("base64url"),
          }),
    });

  const writable = (res, name, expectedRevision) => {
    const instance = find(name);
    if (instance === undefined) {
      refuse(res, 404, "worker.instance.not_found", "The worker instance does not exist.");
      return null;
    }
    if (!live(instance)) {
      refuse(res, 409, "worker.instance.archived", "The worker instance is archived.");
      return null;
    }
    if (instance.record.revision !== expectedRevision) {
      refuse(
        res,
        409,
        "worker.instance.revision_conflict",
        "The expected revision is not the live revision.",
      );
      return null;
    }
    return instance;
  };

  on("GET", /^\/api\/worker\/instance$/, (_m, _b, res, _t, url) => {
    const worker = url.searchParams.get("worker");
    const includeArchived = url.searchParams.get("include_archived") === "true";
    const items = instances
      .filter((instance) => worker === null || instance.record.worker === worker)
      .filter((instance) => includeArchived || live(instance))
      .sort((a, b) => a.record.name.localeCompare(b.record.name))
      .map(listItem);
    return json(res, 200, page(items, url));
  });

  on("GET", /^\/api\/worker\/instance\/([^/]+)$/, (m, _b, res) => {
    const instance = find(decodeURIComponent(m[1]));
    if (instance === undefined) {
      return refuse(res, 404, "worker.instance.not_found", "The worker instance does not exist.");
    }
    return json(res, 200, detail(instance));
  });

  on("POST", /^\/api\/worker\/instance$/, (_m, b, res) => {
    const name = b?.name;
    if (typeof name !== "string" || !INSTANCE_NAME.test(name) || RESERVED_NAMES.includes(name)) {
      return refuse(
        res,
        400,
        "worker.instance.name_invalid",
        "The name breaks the form or is reserved.",
      );
    }
    const hosted = fx.WORKER_CATALOG.some(
      (worker) => worker.name === b.worker && worker.host === "kanthord",
    );
    if (!hosted) {
      return refuse(
        res,
        400,
        "worker.instance.worker_invalid",
        "The worker is unknown or is a worker of an external harness.",
      );
    }
    if (find(name) !== undefined) {
      return refuse(res, 409, "worker.instance.name_conflict", "The instance name is taken.");
    }
    const key = keyOrRefuse(res, b);
    if (key === null) return undefined;
    const record = {
      id: `worker_instance_0${ulidTail()}`,
      name,
      worker: b.worker,
      revision: 1,
      public_key: key.publicKey,
      fingerprint: fingerprintOf(key.publicKey),
      created_at: Date.now(),
      ended_at: null,
    };
    instances.push({ record, connection: null });
    return writeAnswer(res, record, b.endpoint, key.privateKey);
  });

  on("POST", /^\/api\/worker\/instance\/([^/]+)\/revision$/, (m, b, res) => {
    const instance = writable(res, decodeURIComponent(m[1]), b?.expected_revision);
    if (instance === null) return undefined;
    const key = keyOrRefuse(res, b);
    if (key === null) return undefined;
    instance.record = {
      ...instance.record,
      id: `worker_instance_0${ulidTail()}`,
      revision: instance.record.revision + 1,
      public_key: key.publicKey,
      fingerprint: fingerprintOf(key.publicKey),
      created_at: Date.now(),
    };
    instance.connection = null;
    for (const credential of credentials) {
      if (credential.holder === instance.record.name) credential.sealed_current = false;
    }
    for (let index = fx.WORKER_REGISTRATIONS.length - 1; index >= 0; index -= 1) {
      if (fx.WORKER_REGISTRATIONS[index].instance === instance.record.name) {
        fx.WORKER_REGISTRATIONS.splice(index, 1);
      }
    }
    return writeAnswer(res, instance.record, b.endpoint, key.privateKey);
  });

  on("POST", /^\/api\/worker\/instance\/([^/]+)\/archive$/, (m, b, res) => {
    const instance = writable(res, decodeURIComponent(m[1]), b?.expected_revision);
    if (instance === null) return undefined;
    const bindings = bindingsOf(instance.record.name);
    if (bindings.length > 0) {
      return refuse(res, 409, "worker.instance.in_use", "A binding lists the worker instance.", {
        bindings,
      });
    }
    const executions = registrationsOf(instance.record.name)
      .filter((registration) => registration.execution_id !== undefined)
      .map((registration) => registration.execution_id);
    if (executions.length > 0) {
      return refuse(
        res,
        409,
        "worker.instance.in_use",
        "A registration of the worker instance holds a live execution.",
        { executions },
      );
    }
    const endedAt = Date.now();
    instance.record = { ...instance.record, ended_at: endedAt };
    instance.connection = null;
    for (const credential of credentials) {
      if (credential.holder !== instance.record.name) continue;
      for (const revision of credential.revisions) revision.ended_at ??= endedAt;
    }
    return json(res, 200, instance.record);
  });

  return {
    liveInstance: (name) => {
      const instance = find(name);
      return instance !== undefined && live(instance) ? instance : null;
    },
  };
}
