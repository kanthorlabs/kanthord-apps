import { randomBytes } from "node:crypto";

import { AGENT_VARIANT_INSTRUCTION_MAX_BYTES, AGENT_VARIANT_NAME_MAX_CHARS } from "./fixtures.mjs";

const GUARD_AGENT = "guard@1";
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CONTROL_CHARACTER = /\p{Cc}/u;

const variantIdOf = () =>
  `agent_variant_${Array.from(randomBytes(26), (byte) => ULID_ALPHABET[byte % 32]).join("")}`;

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

  const nameInvalid = (name) =>
    name !== name.trim() ||
    name === "" ||
    [...name].length > AGENT_VARIANT_NAME_MAX_CHARS ||
    CONTROL_CHARACTER.test(name);

  const refuseName = (res, name, selfId) => {
    if (nameInvalid(name)) {
      return envelope(
        res,
        400,
        "agent.variant.name_invalid",
        "The variant name is blank, has outer spaces or a control character, or is too long.",
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
    const variant = variants.find((item) => item.id === decodeURIComponent(rawId));
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
      { current: structuredClone(variant) },
    );
  };

  on("GET", /^\/api\/agent\/variant$/, (_m, _b, res) =>
    json(res, 200, {
      items: [...variants].sort((left, right) => (left.id < right.id ? -1 : 1)).map(itemOf),
    }),
  );

  on("POST", /^\/api\/agent\/variant$/, (_m, body, res) => {
    const invalid = refuseBody(res, body, ["agent_name", "display_name"]);
    if (invalid !== null) return invalid;
    const base = agents.find((agent) => agent.agent_name === body.agent_name);
    if (base === undefined || body.agent_name === GUARD_AGENT || base.workbench !== true) {
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
    const refused =
      refuseName(res, body.display_name, variant.id) ??
      refuseRevision(res, variant, body.expected_revision);
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
      return envelope(res, 409, "agent.variant.in_use", "A workbench session uses the variant.", {
        variant_id: variant.id,
      });
    }
    variants.splice(variants.indexOf(variant), 1);
    return json(res, 204, null);
  });
};
