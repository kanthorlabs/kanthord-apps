import { randomBytes } from "node:crypto";

import * as fx from "./fixtures.mjs";
import { canonicalJson, fingerprintOf, ulidTail } from "./instances.mjs";

const MACHINE_NAME = /^[a-z][a-z0-9-]{0,62}$/;
const RESERVED_NAMES = ["server", "token", "connect", "heartbeat", "work"];
const PUBLIC_KEY = /^[A-Za-z0-9_-]{43}$/;

export function registerMachines({ on, json, envelope, page, instancesOf, instanceNames }) {
  const machines = structuredClone(fx.WORKER_MACHINES);

  const refuse = (res, status, code, message, details = null) =>
    envelope(res, status, code, message, details);

  const find = (name) => machines.find((machine) => machine.name === name);

  const live = (machine) => machine.ended_at === null;

  const liveInstancesOf = (name) =>
    instancesOf(name).filter((instance) => instance.record.ended_at === null);

  const listItem = (machine) => ({
    ...machine,
    instance_count: liveInstancesOf(machine.name).length,
  });

  const detail = (machine) => ({
    ...machine,
    instances: instancesOf(machine.name).map((instance) => ({
      ...instance.record,
      connection: instance.connection,
    })),
  });

  const writeAnswer = (res, machine, privateKey) =>
    json(res, 200, {
      ...machine,
      ...(privateKey === null
        ? {}
        : {
            machine_configuration: Buffer.from(
              canonicalJson({
                name: machine.name,
                machine_id: machine.id,
                private_key: privateKey,
              }),
              "utf8",
            ).toString("base64url"),
          }),
    });

  const writable = (res, name, expectedRevision) => {
    const machine = find(name);
    if (machine === undefined) {
      refuse(res, 404, "worker.machine.not_found", "The worker machine does not exist.");
      return null;
    }
    if (!live(machine)) {
      refuse(res, 409, "worker.machine.archived", "The worker machine is archived.");
      return null;
    }
    if (machine.revision !== expectedRevision) {
      refuse(
        res,
        409,
        "worker.machine.revision_conflict",
        "The expected revision is not the live revision.",
        { revision: machine.revision },
      );
      return null;
    }
    return machine;
  };

  on("GET", /^\/api\/worker\/machine$/, (_m, _b, res, _t, url) => {
    const items = machines
      .filter(live)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(listItem);
    return json(res, 200, page(items, url));
  });

  on("GET", /^\/api\/worker\/machine\/([^/]+)$/, (m, _b, res) => {
    const machine = find(decodeURIComponent(m[1]));
    if (machine === undefined) {
      return refuse(res, 404, "worker.machine.not_found", "The worker machine does not exist.");
    }
    return json(res, 200, detail(machine));
  });

  on("POST", /^\/api\/worker\/machine$/, (_m, b, res) => {
    const name = b?.name;
    if (typeof name !== "string" || !MACHINE_NAME.test(name) || RESERVED_NAMES.includes(name)) {
      return refuse(
        res,
        400,
        "worker.machine.name_invalid",
        "The name breaks the form or is reserved.",
      );
    }
    const supplied = b.public_key;
    if (supplied !== undefined && !PUBLIC_KEY.test(supplied)) {
      return refuse(
        res,
        400,
        "worker.machine.key_invalid",
        "The public_key is not a base64url X25519 key.",
      );
    }
    if (find(name) !== undefined || instanceNames().includes(name)) {
      return refuse(res, 409, "worker.machine.name_conflict", "The machine name is taken.");
    }
    if (supplied !== undefined && machines.some((machine) => machine.public_key === supplied)) {
      return refuse(res, 409, "worker.machine.key_conflict", "A machine holds this public key.");
    }
    const publicKey = supplied ?? randomBytes(32).toString("base64url");
    const privateKey = supplied === undefined ? randomBytes(32).toString("base64url") : null;
    const machine = {
      id: `worker_machine_0${ulidTail()}`,
      name,
      revision: 1,
      public_key: publicKey,
      fingerprint: fingerprintOf(publicKey),
      created_at: Date.now(),
      ended_at: null,
    };
    machines.push(machine);
    return writeAnswer(res, machine, privateKey);
  });

  on("POST", /^\/api\/worker\/machine\/([^/]+)\/revision$/, (m, b, res) => {
    const machine = writable(res, decodeURIComponent(m[1]), b?.expected_revision);
    if (machine === null) return undefined;
    const publicKey = randomBytes(32).toString("base64url");
    const privateKey = randomBytes(32).toString("base64url");
    Object.assign(machine, {
      id: `worker_machine_0${ulidTail()}`,
      revision: machine.revision + 1,
      public_key: publicKey,
      fingerprint: fingerprintOf(publicKey),
      created_at: Date.now(),
    });
    return writeAnswer(res, machine, privateKey);
  });

  on("POST", /^\/api\/worker\/machine\/([^/]+)\/archive$/, (m, b, res) => {
    const machine = writable(res, decodeURIComponent(m[1]), b?.expected_revision);
    if (machine === null) return undefined;
    const instances = liveInstancesOf(machine.name).map((instance) => instance.record.name);
    if (instances.length > 0) {
      return refuse(res, 409, "worker.machine.in_use", "A live instance names the machine.", {
        instances,
      });
    }
    machine.ended_at = Date.now();
    return json(res, 200, machine);
  });

  return {
    liveMachine: (name) => {
      const machine = find(name);
      return machine !== undefined && live(machine) ? machine : null;
    },
    machineNames: () => machines.map((machine) => machine.name),
  };
}
