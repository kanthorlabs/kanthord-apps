import { randomBytes } from "node:crypto";

import { AGENT_VARIANT_INSTRUCTION_MAX_BYTES } from "./fixtures.mjs";

const GUARD_AGENT = "guard@1";
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const VARIANT_NAME = /^[A-Za-z][A-Za-z0-9_-]*( [A-Za-z0-9_-]+)*$/;
const VARIANT_NAME_MAX_CHARS = 40;
export const VARIANT_ID = /^agent_variant_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

const variantIdOf = () =>
  `agent_variant_${Array.from(
    randomBytes(26),
    (byte, index) => ULID_ALPHABET[index === 0 ? byte % 8 : byte % 32],
  ).join("")}`;

const compareCodeUnits = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const itemOf = ({ id, agent_name, display_name, revision }) => ({
  id,
  agent_name,
  display_name,
  revision,
});

const isRevision = (value) => Number.isInteger(value) && value > 0;

export const registerVariants = ({ on, json, envelope, agents, variants, hasSession }) => {
  const refuseField = (res, field, code = "custom") =>
    envelope(res, 400, "gateway.request.validation_failed", "Request validation failed.", [
      { path: ["body", field], code },
    ]);

  const instructionRefused = (instruction) =>
    typeof instruction !== "string" ||
    instruction.trim() === "" ||
    Buffer.byteLength(instruction) > AGENT_VARIANT_INSTRUCTION_MAX_BYTES;

  const refuseBody = (res, body, fields) => {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return envelope(res, 400, "gateway.request.validation_failed", "Request validation failed.");
    }
    const text = fields.find((field) => typeof body[field] !== "string");
    if (text !== undefined) return refuseField(res, text, "invalid_type");
    if (instructionRefused(body.instruction)) return refuseField(res, "instruction");
    return null;
  };

  const nameInvalid = (name) => name.length > VARIANT_NAME_MAX_CHARS || !VARIANT_NAME.test(name);

  const refuseName = (res, name, selfId) => {
    if (nameInvalid(name)) {
      return envelope(
        res,
        400,
        "agent.variant.name_invalid",
        "The variant name must be 1 to 40 letters, digits, spaces, _ or -, starting with a letter.",
      );
    }
    const folded = name.toLowerCase();
    const taken =
      agents.some((agent) => agent.display_name.toLowerCase() === folded) ||
      variants.some(
        (variant) => variant.id !== selfId && variant.display_name.toLowerCase() === folded,
      );
    if (!taken) return null;
    return envelope(
      res,
      409,
      "agent.variant.name_taken",
      "Another agent or variant already uses the display name.",
    );
  };

  const variantOrRefuse = (res, rawId) => {
    const id = decodeURIComponent(rawId);
    if (!VARIANT_ID.test(id)) {
      envelope(res, 400, "gateway.request.validation_failed", "Request validation failed.", [
        { path: ["params", "variant_id"], code: "custom" },
      ]);
      return null;
    }
    const variant = variants.find((item) => item.id === id);
    if (variant !== undefined) return variant;
    envelope(res, 404, "agent.variant.not_found", "The variant does not exist.");
    return null;
  };

  const refuseRevision = (res, variant, expected) => {
    if (variant.revision === expected) return null;
    return envelope(
      res,
      409,
      "agent.variant.revision_conflict",
      "The variant changed since it was read.",
      { variant_id: variant.id, current: structuredClone(variant) },
    );
  };

  on("GET", /^\/api\/agent\/variant$/, (_m, _b, res) =>
    json(res, 200, {
      items: [...variants]
        .sort(
          (left, right) =>
            compareCodeUnits(left.agent_name, right.agent_name) ||
            compareCodeUnits(left.display_name, right.display_name),
        )
        .map(itemOf),
    }),
  );

  on("POST", /^\/api\/agent\/variant$/, (_m, body, res) => {
    const invalid = refuseBody(res, body, ["agent_name", "display_name"]);
    if (invalid !== null) return invalid;
    const base = agents.find((agent) => agent.agent_name === body.agent_name);
    if (base === undefined) {
      return envelope(res, 404, "agent.catalog.not_found", "The agent is absent from the catalog.");
    }
    if (body.agent_name === GUARD_AGENT || base.workbench !== true) {
      return envelope(res, 409, "agent.variant.base_refused", "The agent serves no variant.");
    }
    const refused = refuseName(res, body.display_name, null);
    if (refused !== null) return refused;
    const variant = {
      id: variantIdOf(),
      agent_name: body.agent_name,
      display_name: body.display_name,
      instruction: body.instruction,
      revision: 1,
    };
    variants.push(variant);
    return json(res, 200, variant);
  });

  on("GET", /^\/api\/agent\/variant\/([^/]+)$/, (m, _b, res) => {
    const variant = variantOrRefuse(res, m[1]);
    if (variant === null) return undefined;
    return json(res, 200, variant);
  });

  on("PUT", /^\/api\/agent\/variant\/([^/]+)$/, (m, body, res) => {
    const invalid = refuseBody(res, body, ["display_name"]);
    if (invalid !== null) return invalid;
    if (!isRevision(body.expected_revision)) return refuseField(res, "expected_revision");
    const variant = variantOrRefuse(res, m[1]);
    if (variant === null) return undefined;
    if (refuseRevision(res, variant, body.expected_revision) !== null) return undefined;
    const refused = refuseName(res, body.display_name, variant.id);
    if (refused !== null) return refused;
    variant.display_name = body.display_name;
    variant.instruction = body.instruction;
    variant.revision += 1;
    return json(res, 200, variant);
  });

  on("DELETE", /^\/api\/agent\/variant\/([^/]+)$/, (m, body, res) => {
    if (!isRevision(body?.expected_revision)) return refuseField(res, "expected_revision");
    const variant = variantOrRefuse(res, m[1]);
    if (variant === null) return undefined;
    const refused = refuseRevision(res, variant, body.expected_revision);
    if (refused !== null) return refused;
    if (hasSession(variant.id)) {
      return envelope(res, 409, "agent.variant.in_use", "A workbench session uses the variant.");
    }
    variants.splice(variants.indexOf(variant), 1);
    return json(res, 200, { id: variant.id });
  });
};
