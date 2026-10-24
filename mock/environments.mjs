import { createHash } from "node:crypto";

const SCENARIO = process.env.KANTHORD_MOCK_ENVIRONMENT ?? "ready";
const STARTED_AT = Date.now();
const STEPS = ["building", "proving", "ready"];
const ACTIVE_STATUSES = ["pending", "building", "proving"];
const READS_PER_STEP = 3;
const READS_PER_REPAIR = 6;
const COMMIT = "4f0184b";
const FIXTURE_DOCUMENT = {
  image: "mcr.microsoft.com/devcontainers/javascript-node:24-bookworm",
  updateContentCommand: "pnpm install --frozen-lockfile",
  customizations: { kanthord: { checks: ["node --version", "pnpm --version"] } },
};
const RED_BASELINE = [{ command: "pnpm test", exit_code: 1 }];

const digestOf = (name) => createHash("sha256").update(name).digest("hex");
const tagOf = (name) => `localhost/kanthord-env/${name}:${digestOf(name)}`;
const isActive = (record) => ACTIVE_STATUSES.includes(record.status);
const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const failureOf = (name) => ({
  class: "command_absent",
  origin: "onboarding",
  execution_id: null,
  command: "pnpm",
  exit_code: 127,
  tail: "bash: line 1: pnpm: command not found",
  reproduce: `podman run --rm -it ${tagOf(name)} bash -c 'pnpm install --frozen-lockfile'`,
  ended_at: STARTED_AT,
});

const initialRecordOf = (name, leading) => {
  if (leading && SCENARIO === "building") {
    return {
      status: "building",
      run_started_at: STARTED_AT,
      step_started_at: STARTED_AT,
      failure: null,
      reads: 0,
    };
  }
  if (leading && SCENARIO === "repairing") {
    return {
      status: "failed",
      run_started_at: null,
      step_started_at: null,
      failure: failureOf(name),
      repairing: true,
      repairs: 1,
      reads: 0,
    };
  }
  if (leading && SCENARIO === "failed") {
    return {
      status: "failed",
      run_started_at: null,
      step_started_at: null,
      failure: failureOf(name),
      reads: 0,
    };
  }
  return { status: "ready", run_started_at: null, step_started_at: null, failure: null, reads: 0 };
};

const finishRepair = (record) => {
  record.status = "building";
  record.run_started_at = Date.now();
  record.step_started_at = record.run_started_at;
  record.failure = null;
  record.repairing = false;
  record.reads = 0;
};

const advance = (record) => {
  record.status = STEPS[STEPS.indexOf(record.status) + 1] ?? "ready";
  record.step_started_at = Date.now();
};

const startRun = (record) => {
  const now = Date.now();
  record.status = "building";
  record.run_started_at = now;
  record.step_started_at = now;
  record.failure = null;
  record.reads = 0;
};

export function registerEnvironments({
  on,
  json,
  envelope,
  projectOrRefuse,
  bindingSetOf,
  bindingIdOf,
}) {
  const recordsByProject = new Map();
  const secretRecords = new Map();
  let secretSequence = 0;

  const repositoryNamesOf = (projectId) =>
    Object.entries(bindingSetOf(projectId).bindings)
      .filter(([, entry]) => entry.kind === "repository")
      .map(([name]) => name)
      .sort();

  const recordsOf = (projectId) => {
    if (!recordsByProject.has(projectId)) recordsByProject.set(projectId, new Map());
    const records = recordsByProject.get(projectId);
    repositoryNamesOf(projectId).forEach((name, index) => {
      if (records.has(name)) return;
      records.set(name, initialRecordOf(name, index === 0 && records.size === 0));
    });
    return records;
  };

  const configOf = (projectId, name) => bindingSetOf(projectId).bindings[name].config;

  const stateOf = (projectId, name, index, record) => {
    const built = ["proving", "ready", "failed"].includes(record.status);
    return {
      binding_id: bindingIdOf(name),
      binding_name: name,
      resource_identity: `repository:${name}`,
      target: "image",
      source: configOf(projectId, name).environment === undefined ? "detected" : "stored",
      status: record.status,
      digest: built ? digestOf(name) : null,
      tag: built ? tagOf(name) : null,
      run_started_at: record.run_started_at,
      step_started_at: record.step_started_at,
      reason: null,
      failure: record.failure,
      checks: record.status === "ready" && index === 1 ? RED_BASELINE : [],
      repairs: record.repairs ?? 0,
      repairing: record.repairing ?? false,
    };
  };

  const bindingOrRefuse = (res, projectId, encodedBindingId) => {
    const bindingId = decodeURIComponent(encodedBindingId);
    const names = repositoryNamesOf(projectId);
    const name = names.find((candidate) => bindingIdOf(candidate) === bindingId);
    if (name === undefined) {
      envelope(res, 404, "project.binding.not_found", "No such binding.");
      return undefined;
    }
    return { name, index: names.indexOf(name), record: recordsOf(projectId).get(name) };
  };

  on("GET", /^\/api\/project\/([^/]+)\/environment$/, (m, _b, res) => {
    const project = projectOrRefuse(res, m[1]);
    if (project === undefined) return undefined;
    const items = [...recordsOf(project.id)]
      .filter(([name]) => repositoryNamesOf(project.id).includes(name))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([name, record], index) => {
        if (record.repairing) {
          record.reads += 1;
          if (record.reads >= READS_PER_REPAIR) finishRepair(record);
        } else if (isActive(record)) {
          record.reads += 1;
          if (record.reads % READS_PER_STEP === 0) advance(record);
        }
        return stateOf(project.id, name, index, record);
      });
    return json(res, 200, { items });
  });

  on("POST", /^\/api\/project\/([^/]+)\/binding\/([^/]+)\/environment\/rebuild$/, (m, _b, res) => {
    const project = projectOrRefuse(res, m[1]);
    if (project === undefined) return undefined;
    const binding = bindingOrRefuse(res, project.id, m[2]);
    if (binding === undefined) return undefined;
    if (isActive(binding.record)) {
      return envelope(
        res,
        409,
        "project.environment.run_active",
        "An environment run of the binding is active.",
      );
    }
    startRun(binding.record);
    return json(res, 200, stateOf(project.id, binding.name, binding.index, binding.record));
  });

  on("GET", /^\/api\/project\/([^/]+)\/binding\/([^/]+)\/environment$/, (m, _b, res) => {
    const project = projectOrRefuse(res, m[1]);
    if (project === undefined) return undefined;
    const binding = bindingOrRefuse(res, project.id, m[2]);
    if (binding === undefined) return undefined;
    const config = configOf(project.id, binding.name);
    return json(res, 200, {
      source: config.environment === undefined ? "detected" : "stored",
      commit: COMMIT,
      environment: config.environment ?? FIXTURE_DOCUMENT,
      reason: null,
    });
  });

  on("PUT", /^\/api\/project\/([^/]+)\/binding\/([^/]+)\/environment$/, (m, b, res) => {
    const project = projectOrRefuse(res, m[1]);
    if (project === undefined) return undefined;
    const binding = bindingOrRefuse(res, project.id, m[2]);
    if (binding === undefined) return undefined;
    const environment = b?.environment;
    if (!isPlainObject(environment)) {
      return envelope(
        res,
        400,
        "project.environment.invalid",
        "The environment is not one JSON object.",
      );
    }
    if ("runArgs" in environment) {
      return envelope(
        res,
        400,
        "project.environment.key_refused",
        "The environment key runArgs is refused: the key is not allowed.",
        { key: "runArgs", reason: "the key is not allowed" },
      );
    }
    const set = bindingSetOf(project.id);
    configOf(project.id, binding.name).environment = environment;
    set.version += 1;
    startRun(binding.record);
    return json(res, 200, {
      project_id: project.id,
      binding_set_version: set.version,
      changes: [{ kind: "revised", binding_id: bindingIdOf(binding.name) }],
    });
  });

  const secretRevisionOf = (revision) => {
    secretSequence += 1;
    return {
      id: `credential_revision_ENVSECRET${String(secretSequence).padStart(4, "0")}`,
      revision,
      metadata: null,
      created_at: Date.now(),
      ended_at: null,
    };
  };

  const secretOrRefuse = (res, encodedName) => {
    const record = secretRecords.get(decodeURIComponent(encodedName));
    if (record === undefined) {
      envelope(res, 404, "credential.credential.not_found", "Credential not found.");
    }
    return record;
  };

  const isSecretBody = (secret) =>
    isPlainObject(secret) && typeof secret.key === "string" && secret.key !== "";

  const refuseInvalidSecret = (res) =>
    envelope(res, 400, "credential.input.invalid", "Invalid input.");

  on("GET", /^\/api\/project\/credential\/([^/]+)$/, (m, _b, res) => {
    const record = secretOrRefuse(res, m[1]);
    if (record === undefined) return undefined;
    return json(res, 200, record);
  });

  on("POST", /^\/api\/project\/credential$/, (_m, b, res) => {
    if (
      typeof b?.name !== "string" ||
      b.name === "" ||
      b.platform !== "environment_secret" ||
      b.metadata !== null ||
      !isSecretBody(b.secret)
    ) {
      return refuseInvalidSecret(res);
    }
    if (secretRecords.has(b.name)) {
      return envelope(res, 409, "credential.credential.exists", "The credential exists.");
    }
    const record = {
      name: b.name,
      platform: "environment_secret",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [secretRevisionOf(1)],
    };
    secretRecords.set(b.name, record);
    return json(res, 200, record);
  });

  on("POST", /^\/api\/project\/credential\/([^/]+)\/revision$/, (m, b, res) => {
    const record = secretOrRefuse(res, m[1]);
    if (record === undefined) return undefined;
    if (!isSecretBody(b?.secret) || !Number.isInteger(b?.expected_revision)) {
      return refuseInvalidSecret(res);
    }
    const newest = record.revisions[0];
    if (newest.revision !== b.expected_revision) {
      return envelope(
        res,
        409,
        "credential.revision.conflict",
        "The expected revision is not the newest live revision.",
      );
    }
    newest.ended_at = Date.now();
    record.revisions.unshift(secretRevisionOf(newest.revision + 1));
    return json(res, 200, record);
  });

  return {
    absentSecretOf: (bindings) => {
      for (const [binding, entry] of Object.entries(bindings)) {
        if (entry.kind !== "repository") continue;
        for (const [variable, credential] of Object.entries(
          entry.config.environment_secrets ?? {},
        )) {
          if (!secretRecords.has(credential)) return { binding, variable, credential };
        }
      }
      return null;
    },
  };
}
