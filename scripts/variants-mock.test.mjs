import { describe, expect, it } from "vitest";

import { AGENT_DECLARATIONS } from "../mock/fixtures.mjs";
import { registerVariants, VARIANT_ID } from "../mock/variants.mjs";

const USED_ID = "agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0VA1";
const FREE_ID = "agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0VB2";
const MISSING_ID = "agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0ZZZ";
const INSTRUCTION = "Weigh each change against the structure.";

const variantOf = (id, agentName, displayName) => ({
  id,
  agent_name: agentName,
  display_name: displayName,
  instruction: INSTRUCTION,
  revision: 1,
});

const mockDaemon = () => {
  const routes = [];
  const variants = [
    variantOf(USED_ID, "swe@1", "Software Architecture"),
    variantOf(FREE_ID, "swe@1", "apple"),
  ];
  registerVariants({
    on: (method, pattern, handler) => routes.push({ method, pattern, handler }),
    json: (res, status, body) => res.reply({ status, body }),
    envelope: (res, status, code, message, details = null) =>
      res.reply({ status, body: { error: { code, message, details } } }),
    agents: structuredClone(AGENT_DECLARATIONS),
    variants,
    hasSession: (variantId) => variantId === USED_ID,
  });
  const call = (method, path, body = {}) => {
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.pattern.test(path),
    );
    let answer;
    route.handler(path.match(route.pattern), body, { reply: (a) => (answer = a) });
    return answer;
  };
  return { call };
};

describe("variant routes of the mock daemon", () => {
  it("lists variants by agent name, then display name in code unit order", () => {
    const daemon = mockDaemon();

    const names = daemon
      .call("GET", "/api/agent/variant")
      .body.items.map((item) => item.display_name);

    expect(names).toEqual(["Software Architecture", "apple"]);
  });

  it("refuses a create for an unknown agent with 404 and no details", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("POST", "/api/agent/variant", {
      agent_name: "none@1",
      display_name: "Reviewer",
      instruction: INSTRUCTION,
    });

    expect(answer.status).toBe(404);
    expect(answer.body.error).toMatchObject({ code: "agent.catalog.not_found", details: null });
  });

  it("refuses a create for guard@1 with 409 base_refused", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("POST", "/api/agent/variant", {
      agent_name: "guard@1",
      display_name: "Reviewer",
      instruction: INSTRUCTION,
    });

    expect(answer.status).toBe(409);
    expect(answer.body.error.code).toBe("agent.variant.base_refused");
  });

  it("creates a variant with an id that the engine id rule accepts", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("POST", "/api/agent/variant", {
      agent_name: "swe@1",
      display_name: "Reviewer",
      instruction: INSTRUCTION,
    });

    expect(answer.status).toBe(200);
    expect(answer.body.id).toMatch(VARIANT_ID);
  });

  it("refuses a malformed variant id with 400 at the params path", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("GET", "/api/agent/variant/agent_variant_none");

    expect(answer.status).toBe(400);
    expect(answer.body.error).toMatchObject({
      code: "gateway.request.validation_failed",
      details: [{ path: ["params", "variant_id"], code: "custom" }],
    });
  });

  it("answers 404 for a well-formed variant id that does not exist", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("GET", `/api/agent/variant/${MISSING_ID}`);

    expect(answer.status).toBe(404);
    expect(answer.body.error.code).toBe("agent.variant.not_found");
  });

  it("checks the revision before the name on an update", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("PUT", `/api/agent/variant/${FREE_ID}`, {
      display_name: "Software Architecture",
      instruction: INSTRUCTION,
      expected_revision: 7,
    });

    expect(answer.status).toBe(409);
    expect(answer.body.error.code).toBe("agent.variant.revision_conflict");
    expect(answer.body.error.details).toMatchObject({
      variant_id: FREE_ID,
      current: { id: FREE_ID, revision: 1 },
    });
  });

  it("refuses the delete of a used variant with 409 in_use and no details", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("DELETE", `/api/agent/variant/${USED_ID}`, {
      expected_revision: 1,
    });

    expect(answer.status).toBe(409);
    expect(answer.body.error).toMatchObject({ code: "agent.variant.in_use", details: null });
  });

  it("deletes an unused variant with 200 and the id", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("DELETE", `/api/agent/variant/${FREE_ID}`, {
      expected_revision: 1,
    });

    expect(answer).toEqual({ status: 200, body: { id: FREE_ID } });
  });
});
