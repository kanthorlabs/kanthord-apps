import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as fx from "../mock/fixtures.mjs";
import { routes } from "../mock/routes.mjs";
import {
  describeRoute,
  makeClient,
  routesWithoutOperation,
  routesWithoutRequest,
  startMock,
  stopMock,
} from "./mock-harness.mjs";

let mock;
let client;
const refusals = {};

const readOnlyRequests = async (call) => {
  const project = fx.PROJECT.id;
  const mission = fx.MISSION.id;
  const node = fx.GRAPH_IDS.signup;
  const evidenceAsset = fx.GRAPH_EVIDENCE[1].assets[0].id;
  const bindings = (await call("GET", `/api/project/${project}/binding`)).body.items;
  const binding = bindings.find((item) => item.name === "kanthord-repo");
  const workerBinding = bindings.find((item) => item.name === "general-main");
  const traces = (await call("GET", "/api/tracking/trace")).body.items;
  const trace = traces[0];

  await call("GET", "/api/liveness", { token: null });
  await call("GET", "/api/openapi.yaml");
  await call("GET", "/api/auth/verify");
  await call("GET", "/api/project");
  await call("GET", `/api/project/${project}`);
  await call("GET", "/api/worker/catalog");
  await call("GET", "/api/worker/catalog/coder@1");
  await call("GET", "/api/worker/registration");
  await call("GET", "/api/worker/placement");
  await call("GET", "/api/agent");
  await call("GET", "/api/agent/swe@1");
  await call("GET", "/api/agent/model?provider=openai-compatible&credential=atlas-router");
  await call("GET", "/api/agent/cooldown");
  await call("GET", "/api/agent/enablement");
  await call("GET", "/api/agent/enablement/swe@1");
  await call("GET", "/api/agent/enablement/swe@1/provider/atlas-llm/model");
  await call("GET", "/api/agent/variant");
  await call("GET", `/api/agent/variant/${fx.AGENT_VARIANTS[0].id}`);
  await call("GET", `/api/mission/project/${project}`);
  await call("GET", `/api/mission/${mission}/export`);
  await call("GET", `/api/mission/${mission}/export?format=json`);
  await call("GET", `/api/mission/${mission}/node`);
  await call("GET", `/api/mission/${mission}/edge`);
  await call("GET", `/api/mission/node/${node}`);
  await call("GET", `/api/mission/node/${node}/revision`);
  await call("GET", `/api/mission/node/${node}/revision/1`);
  await call("GET", `/api/mission/node/${node}/attempt`);
  await call("GET", `/api/mission/node/${node}/evidence`);
  await call("GET", `/api/mission/evidence/asset/${evidenceAsset}/content/download`);
  await call("GET", `/api/mission/node/${node}/assessment`);
  await call("GET", `/api/mission/node/${node}/outcome`);
  await call("GET", `/api/mission/node/${fx.GRAPH_IDS.team}/proposal`);
  await call("GET", `/api/mission/node/${fx.GRAPH_IDS.webhook}/link-update`);
  await call("GET", "/api/mission/inbox-item");
  await call("GET", `/api/mission/project/${project}/followup`);
  await call("GET", `/api/mission/node/${node}/finding`);
  await call("GET", `/api/mission/finding/${fx.GRAPH_FINDINGS[0].id}`);
  await call("GET", `/api/mission/project/${project}/undecided-finding`);
  await call("GET", `/api/mission/node/${fx.GRAPH_IDS.webhook}/external-action`);
  await call("GET", `/api/project/${project}/binding-set`);
  await call("GET", `/api/project/${project}/binding/${binding.id}`);
  await call("GET", `/api/project/${project}/binding/${workerBinding.id}/agent`);
  await call("GET", `/api/project/${project}/environment`);
  await call("GET", `/api/project/${project}/binding/${binding.id}/environment`);
  await call("GET", `/api/project/${project}/binding/${binding.id}/suite-pass/plan`);
  await call("GET", `/api/scheduler/project/${project}/queue`);
  await call("GET", `/api/scheduler/project/${project}/execution`);
  await call("GET", "/api/tracking/trace");
  await call("GET", `/api/tracking/timeline?project_id=${project}`);
  await call("GET", "/api/tracking/analytics/flow");
  await call("GET", "/api/tracking/analytics/duration?measure=span_duration");
  await call("GET", "/api/tracking/facet");
  await call("GET", `/api/tracking/trace/${trace.trace_id}`);
  await call("GET", `/api/tracking/trace/${trace.trace_id}/span`);
  await call("GET", "/api/footprint");
  await call("GET", "/api/footprint/kind/trace");
  await call("GET", "/api/footprint/kind/trace/candidate");
  await call("GET", "/api/footprint/kind/trace/item");
  await call("GET", "/api/footprint/cleanup");
  await call("GET", "/api/footprint/alert");
  await call("GET", "/api/worker/machine");
  await call("GET", "/api/worker/machine/lab-01");
  await call("GET", "/api/worker/instance");
  await call("GET", "/api/worker/instance/box-1");
  await call("GET", "/api/repository/host-key");
  await call("GET", "/api/llm/credential");
  await call("GET", "/api/llm/credential/platform");
  await call("GET", "/api/llm/credential/atlas-anthropic?holder=mac-studio");
  await call("GET", "/api/workbench/session");
  await call("GET", `/api/workbench/session/${fx.WORKBENCH_SESSIONS[0].id}`);
  await call("GET", `/api/workbench/session/${fx.WORKBENCH_SESSIONS[0].id}/events`);
};

const SECRET = { key: "contract-test-key" };
const sealedOf = (name, platform) => ({ name, platform, metadata: null, secret: SECRET });

const credentialRequests = async (call) => {
  const created = await call("POST", "/api/llm/credential", {
    body: sealedOf("contract-llm", "anthropic"),
  });
  const revision = created.body.revisions?.[0]?.revision ?? 1;
  await call("POST", "/api/llm/credential/check", {
    body: { platform: "anthropic", metadata: null, secret: SECRET },
  });
  await call("POST", "/api/llm/credential/contract-llm/verify");
  await call("POST", "/api/llm/credential/contract-llm/revision", {
    body: { expected_revision: revision, secret: SECRET },
  });
  await call("PUT", "/api/llm/credential/contract-llm/metadata", {
    body: { expected_revision: revision + 1, metadata: null },
  });
  await call("POST", `/api/llm/credential/contract-llm/revision/${revision}/revoke`);
  await call("POST", "/api/llm/credential/contract-llm/archive");
  const login = await call("POST", "/api/llm/credential/login", {
    body: { platform: "anthropic-subscription", name: "contract-login" },
  });
  await call("GET", `/api/llm/credential/login/${login.body.session_id}`);
  await call("POST", `/api/llm/credential/login/${login.body.session_id}/code`, {
    body: { value: "contract-code" },
  });
  await call("POST", "/api/repository/credential", {
    body: sealedOf("contract-repo", "github"),
  });
  await call("GET", "/api/repository/credential");
  await call("GET", "/api/repository/credential/platform");
  await call("GET", "/api/repository/credential/contract-repo");
  await call("POST", "/api/repository/credential/check", {
    body: { platform: "github", metadata: null, secret: SECRET },
  });
  await call("POST", "/api/repository/credential/contract-repo/verify");
  await call("POST", "/api/repository/credential/contract-repo/revision", {
    body: { expected_revision: 1, secret: SECRET },
  });
  await call("PUT", "/api/repository/credential/contract-repo/metadata", {
    body: { expected_revision: 2, metadata: null },
  });
  await call("POST", "/api/repository/credential/ssh/key", { body: { name: "contract-ssh" } });
  await call("POST", "/api/repository/credential/contract-ssh/ssh/key", {
    body: { expected_revision: 1 },
  });
  await call("POST", "/api/repository/credential/contract-repo/revision/2/revoke");
  await call("POST", "/api/repository/credential/contract-repo/archive");
  await call("POST", "/api/storage/credential", {
    body: {
      name: "contract-store",
      platform: "s3",
      metadata: { endpoint: "https://s3.example.com", bucket: "contract", region: "eu-west-1" },
      secret: { access_key_id: "contract-id", secret_access_key: "contract-secret" },
    },
  });
  await call("GET", "/api/storage/credential");
  await call("GET", "/api/storage/credential/platform");
  await call("GET", "/api/storage/credential/contract-store");
  await call("POST", "/api/storage/credential/contract-store/verify");
  await call("POST", "/api/storage/credential/contract-store/archive");
  await call("GET", "/api/repository/host-key");
  await call("POST", "/api/repository/host-key/scan", { body: { host: "github.com" } });
  const scan = await call("POST", "/api/repository/host-key/scan", {
    body: { host: "gitlab.com" },
  });
  await call("PUT", "/api/repository/host-key/gitlab.com", {
    body: { fingerprint: scan.body.fingerprint },
  });
  await call("POST", "/api/project/credential", {
    body: {
      name: "contract-secret",
      platform: "environment_secret",
      metadata: null,
      secret: SECRET,
    },
  });
  await call("GET", "/api/project/credential/contract-secret");
  await call("POST", "/api/project/credential/contract-secret/revision", {
    body: { expected_revision: 1, secret: SECRET },
  });
};

const missionRequests = async (call) => {
  const project = fx.PROJECT.id;
  const mission = fx.MISSION.id;
  const ids = fx.GRAPH_IDS;
  const versionOf = async () => (await call("GET", `/api/mission/project/${project}`)).body.version;
  const bindings = (await call("GET", `/api/project/${project}/binding`)).body.items;
  const binding = bindings.find((item) => item.name === "kanthord-repo");
  const nodeContent = {
    name: "Contract node",
    requirement: "Keep the mock inside the engine contract.",
    criterion: "The mock answers validate.",
    verifications: ["pnpm test"],
    bindings: [binding.id],
  };

  await call("POST", `/api/mission/inbox-item/${fx.INBOX_ITEMS[0].link_update_id}/done`, {
    body: {},
  });
  const created = await call("POST", `/api/mission/${mission}/node`, {
    body: {
      filename: "contract-node.md",
      content: nodeContent,
      tasks: [],
      reason: "Add a node.",
      expected_mission_version: await versionOf(),
    },
  });
  await call("PUT", `/api/mission/node/${created.body.revisions[0].node_id}`, {
    body: {
      filename: "contract-node.md",
      content: { ...nodeContent, requirement: "Keep the mock in contract." },
      tasks: [],
      reason: "Edit the node.",
      expected_revision: 1,
      expected_mission_version: await versionOf(),
    },
  });
  const decided = fx.GRAPH_PROPOSALS.find((proposal) => proposal.assessment_id?.endsWith("SD2"));
  await call("POST", `/api/mission/assessment/${decided.assessment_id}/decide`, {
    body: {
      expected_mission_version: await versionOf(),
      approved_proposal_ids: [decided.id],
      reason: "Approve.",
    },
  });
  await call("POST", `/api/mission/node/${ids.signup}/followup/decide`, {
    body: { expected_mission_version: await versionOf(), approve: false, reason: "No follow-up." },
  });
  const undecided = (await call("GET", `/api/mission/project/${project}/undecided-finding`)).body
    .items;
  await call("POST", `/api/mission/finding/${undecided[0].id}/decide`, {
    body: { decision: "dismissed", decision_reason: "Not a defect." },
  });
  const finding = await call("POST", `/api/mission/node/${ids.signup}/finding`, {
    body: {
      expected_mission_version: await versionOf(),
      assessment_id: fx.GRAPH_ASSESSMENTS.find((a) => a.node_id === ids.signup).id,
      kind: "suggestion",
      task_id: null,
      name: "Contract finding",
      description: "A finding.",
      fix: "Fix it.",
      why: "It helps.",
      cause_owner: "agent",
    },
  });
  await call("PATCH", `/api/mission/finding/${finding.body.id}`, {
    body: { expected_mission_version: await versionOf(), name: "Contract finding 2" },
  });
  await call("POST", `/api/mission/node/${ids.audit}/unblock`, {
    body: {
      blocked_attempt: 1,
      expected_revision: 2,
      expected_mission_version: await versionOf(),
      reason: "Unblock.",
    },
  });
  await call("POST", `/api/mission/node/${ids.webhook}/check`, {
    body: { expected_mission_version: await versionOf() },
  });
  await call("POST", `/api/mission/node/${ids.metering}/discard`, {
    body: {
      reason: "Discard.",
      expected_mission_version: await versionOf(),
      expected_state: "Pending",
      expected_attempt: 0,
    },
  });
  await call("POST", `/api/mission/node/${ids.codes}/pause`, {
    body: {
      reason: "Pause.",
      expected_mission_version: await versionOf(),
      expected_state: "Executing",
      expected_attempt: 1,
    },
  });
  await call("POST", `/api/mission/node/${ids.changelog}/resume`, {
    body: {
      reason: "Resume.",
      expected_mission_version: await versionOf(),
      expected_state: "Paused",
      expected_attempt: 1,
      target: "Available",
    },
  });
  await call("POST", `/api/mission/node/${ids.invoices}/override`, {
    body: {
      reason: "Override.",
      expected_mission_version: await versionOf(),
      expected_state: "Waiting",
      expected_attempt: 1,
      result: "success",
    },
  });
  await call("DELETE", `/api/mission/node/${ids.recovery}/dependency/${ids.onboarding}`, {
    body: { reason: "Drop it.", expected_mission_version: await versionOf() },
  });
  const exported = (await call("GET", `/api/mission/${mission}/export?format=json`)).body;
  const importBody = {
    format: "json",
    mission_id: mission,
    mission_version: exported.mission_version,
    reason: "Round trip.",
    entries: exported.entries,
  };
  const preview = await call("POST", `/api/mission/${mission}/import/preview`, {
    body: importBody,
  });
  await call("POST", `/api/mission/${mission}/import`, {
    body: {
      ...importBody,
      preview_digest: preview.body.preview_digest,
      confirmed_retirements: preview.body.retirements ?? [],
    },
  });
};

const projectRequests = async (call) => {
  const project = fx.PROJECT.id;
  const created = await call("POST", "/api/project", { body: { name: "contract-demo" } });
  await call("PATCH", `/api/project/${created.body.id}`, { body: { name: "contract-renamed" } });
  await call("POST", `/api/project/${created.body.id}/pause`);
  await call("POST", `/api/project/${created.body.id}/resume`);
  const set = (await call("GET", `/api/project/${project}/binding-set`)).body;
  await call("PUT", `/api/project/${project}/binding-set`, {
    body: { version: set.version, bindings: set.bindings },
  });
  const bindings = (await call("GET", `/api/project/${project}/binding`)).body.items;
  const binding = bindings.find((item) => item.name === "kanthord-repo");
  await call("POST", `/api/project/${project}/binding/${binding.id}/verify`);
  await call("POST", `/api/project/${project}/binding/check`, {
    body: { kind: "repository", config: set.bindings["kanthord-repo"].config },
  });
  await call("PUT", `/api/project/${project}/binding/${binding.id}/environment`, {
    body: { environment: { image: "mcr.microsoft.com/devcontainers/javascript-node:24-bookworm" } },
  });
  const mirror = bindings.find((item) => item.name === "mirror-repo");
  await call("POST", `/api/project/${project}/binding/${mirror.id}/environment/rebuild`);
};

const agentRequests = async (call) => {
  const enablement = (await call("GET", "/api/agent/enablement/swe@1")).body;
  const variant = await call("POST", "/api/agent/variant", {
    body: {
      agent_name: "swe@1",
      display_name: "Contract Variant",
      instruction: "Answer in one line.",
    },
  });
  await call("PUT", `/api/agent/variant/${variant.body.id}`, {
    body: {
      display_name: "Contract Variant 2",
      instruction: "Answer in two lines.",
      expected_revision: variant.body.revision,
    },
  });
  await call("DELETE", `/api/agent/variant/${variant.body.id}`, {
    body: { expected_revision: variant.body.revision + 1 },
  });
  const added = await call("POST", "/api/agent/enablement/swe@1/provider", {
    body: {
      expected_revision: enablement.revision,
      name: "contract-anthropic",
      provider: "anthropic",
      credential: "guard-anthropic",
    },
  });
  await call("PUT", "/api/agent/enablement/swe@1", {
    body: {
      expected_revision: added.body.revision,
      agent_providers: added.body.agent_providers,
      default_configuration: added.body.default_configuration,
      fallback_configurations: added.body.fallback_configurations,
    },
  });
  await call("DELETE", "/api/agent/enablement/swe@1/provider/contract-anthropic", {
    body: { expected_revision: added.body.revision + 1 },
  });
  const disabled = await call("POST", "/api/agent/enablement/swe@1/disable", {
    body: { expected_revision: added.body.revision + 2 },
  });
  await call("POST", "/api/agent/enablement/swe@1/enable", {
    body: { expected_revision: disabled.body.revision },
  });
};

const workerRequests = async (call) => {
  const machine = await call("POST", "/api/worker/machine", { body: { name: "contract-machine" } });
  await call("POST", "/api/worker/machine/contract-machine/revision", {
    body: { expected_revision: machine.body.revision },
  });
  const instance = await call("POST", "/api/worker/instance", {
    body: {
      name: "contract-instance",
      worker: "coder@1",
      placement: "worker",
      machine: "contract-machine",
      public_key: Buffer.alloc(32, 7).toString("base64url"),
    },
  });
  await call("POST", "/api/worker/instance/contract-instance/revision", {
    body: {
      expected_revision: instance.body.revision,
      public_key: Buffer.alloc(32, 9).toString("base64url"),
    },
  });
  await call("POST", "/api/worker/instance/contract-instance/archive", {
    body: { expected_revision: instance.body.revision + 1 },
  });
  await call("POST", "/api/worker/machine/contract-machine/archive", {
    body: { expected_revision: machine.body.revision + 1 },
  });
};

const footprintRequests = async (call) => {
  await call("POST", "/api/footprint/measure");
  const alerts = (await call("GET", "/api/footprint/alert")).body.items;
  await call("POST", `/api/footprint/alert/${alerts[0].alert_id}/acknowledge`);
  const items = (await call("GET", "/api/footprint/kind/trace/item")).body.items;
  const cleanup = await call("POST", "/api/footprint/cleanup", {
    body: { kind: "trace", instance_name: null, rule: null, keys: [items[0].key] },
  });
  await call("GET", `/api/footprint/cleanup/${cleanup.body.cleanup_id}`);
  await call("POST", `/api/footprint/cleanup/${cleanup.body.cleanup_id}/cancel`);
};

const trackingRequests = async (call) => {
  const traces = (await call("GET", "/api/tracking/trace")).body.items;
  const trace = traces.find((item) => item.trace_id === fx.GRAPH_EXECUTIONS[0].trace_id);
  await call("POST", `/api/tracking/trace/${trace.trace_id}/cause/label`, {
    body: { category: "prompt", subcategory: "context_missing", reason: "The context is missing." },
  });
  const spans = (await call("GET", `/api/tracking/trace/${trace.trace_id}/span`)).body.items;
  const entrySpan = spans.find(
    (span) => span.attributes["kanthord.session.entry_id"] !== undefined,
  );
  const session = entrySpan.attributes["gen_ai.conversation.id"];
  const entry = entrySpan.attributes["kanthord.session.entry_id"];
  const entryPath = `/api/tracking/trace/${trace.trace_id}/session/${session}/entry`;
  await call("GET", entryPath);
  await call("GET", `${entryPath}/${entry}`);
  await call("GET", `${entryPath}/${entry}/full`);
  const textSpan = spans.find((span) => span.text_ids?.length > 0);
  await call("GET", `/api/tracking/trace/${trace.trace_id}/text/${textSpan.text_ids[0]}`);
  await call(
    "GET",
    `/api/agent/prompt/resolve?execution_id=${trace.execution_id}&agent_name=${trace.agent_names[0]}`,
  );
};

const WAIT_ATTEMPTS = 40;
const WAIT_INTERVAL_MS = 50;

const waitForEntry = async (call, path, matches) => {
  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
    const answer = await call("GET", path);
    const entry = answer.body.entries?.find(matches);
    if (entry !== undefined) return entry;
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }
  throw new Error(`No matching entry at ${path}.`);
};

const workbenchRequests = async (call) => {
  const project = fx.PROJECT.id;
  const created = await call("POST", "/api/workbench/session", {
    body: {
      agent_provider: "atlas-llm",
      model_identifier: "qwen3-coder",
      reasoning_effort: "off",
      agent_name: "swe@1",
    },
  });
  const session = `/api/workbench/session/${created.body.id}`;
  await call("POST", `${session}/message`, { body: { text: "discard the blocked node" } });
  const offer = await waitForEntry(call, session, (entry) => entry.data?.kind === "action_offer");
  await call("POST", `${session}/action/${offer.data.tool_call_id}/report`, {
    body: { outcome: "failed", error_code: "mission.node.not_found" },
  });
  const queued = await call("POST", `${session}/message`, {
    body: { text: "list the nodes", delivery: "queue" },
  });
  await call("DELETE", `${session}/queue/${queued.body.queued_message_id}`);
  await call("PUT", `${session}/configuration`, {
    body: { agent_provider: "atlas-llm", model_identifier: "qwen3-coder", reasoning_effort: "low" },
  });
  await call("POST", `${session}/auto-mode`, { body: { enabled: true } });
  await call("POST", `${session}/abort`);
  await call("GET", `${session}/events`);
  await call("POST", `${session}/fork`, { body: { text: "Summarise the conversation." } });
  const waiting = fx.WORKBENCH_SESSIONS.find((item) => item.approval !== undefined);
  await call("POST", `/api/workbench/session/${waiting.id}/approve`, {
    body: { tool_call_id: waiting.approval.tool_call_id, approved: false },
  });

  const invite = await call("POST", `${session}/invite`, {
    body: {
      invitee_name: "Dana Lee",
      project_ids: [project],
      granted_operations: ["mission.node.pause"],
    },
  });
  await call("GET", `${session}/invite`);
  const joined = await call("POST", "/api/workbench/invite/join", {
    token: null,
    body: { invite_token: invite.body.invite_token, name: "Dana Lee" },
  });
  const guest = { token: joined.body.guest_token };
  await call("GET", "/api/workbench/guest/session", guest);
  await call("POST", "/api/workbench/guest/session/message", {
    ...guest,
    body: { text: "A note." },
  });
  refusals.unknownMention = await call("POST", "/api/workbench/guest/session/message", {
    ...guest,
    body: { text: "@Unknown hi" },
  });
  refusals.agentRefused = await call("POST", "/api/workbench/guest/session/message", {
    ...guest,
    body: { text: "@SWE hi" },
  });
  await call("GET", "/api/workbench/guest/session/stream", guest);
  const requests = (await call("GET", session)).body.scope_requests;
  await call("POST", `${session}/scope-request/${requests[0].id}/reject`, { body: {} });
  await call("DELETE", `/api/workbench/invite/${invite.body.id}`);

  const second = await call("POST", "/api/workbench/session", {
    body: {
      agent_provider: "atlas-llm",
      model_identifier: "qwen3-coder",
      reasoning_effort: "off",
      agent_name: "swe@1",
    },
  });
  const secondPath = `/api/workbench/session/${second.body.id}`;
  await call("POST", `${secondPath}/invite`, {
    body: {
      invitee_name: "Sam Roe",
      project_ids: [project],
      granted_operations: ["mission.node.pause"],
    },
  });
  const pending = (await call("GET", secondPath)).body.scope_requests[0];
  await call("POST", `${secondPath}/scope-request/${pending.id}/approve`, {
    body: {
      project_name: fx.PROJECT_ORBIT.name,
      expected: { expected_attempt: 0, expected_mission_version: 1, expected_state: "Pending" },
    },
  });
};

const placementRequests = async (call) => {
  await call("PUT", "/api/mock/container", { body: { reason: null, runtime: "podman" } });
};

const runScript = async () => {
  await readOnlyRequests(client.call);
  await credentialRequests(client.call);
  await missionRequests(client.call);
  await projectRequests(client.call);
  await agentRequests(client.call);
  await workerRequests(client.call);
  await footprintRequests(client.call);
  await trackingRequests(client.call);
  await workbenchRequests(client.call);
  await placementRequests(client.call);
};

beforeAll(async () => {
  mock = await startMock();
  client = makeClient(mock);
  await runScript();
}, 60000);

afterAll(async () => {
  if (mock !== undefined) await stopMock(mock);
});

describe("mock contract", () => {
  it("answers each route with a status and a body that the engine declares", () => {
    expect(client.problems).toEqual([]);
    expect(routesWithoutRequest(routes, client.sent).map(describeRoute)).toEqual([]);
    expect(routesWithoutOperation(routes, client.sent).map(describeRoute)).toEqual([]);
  });

  it("fails a route that matches no operation and is not in the exception list", () => {
    const unknown = { method: "GET", pattern: /^\/api\/mock\/unknown$/ };
    const requests = [...client.sent, { method: "GET", path: "/api/mock/unknown" }];

    expect(routesWithoutOperation([...routes, unknown], requests)).toEqual([unknown]);
  });

  it("answers an unhealthy liveness with 503 and an engine error body", async () => {
    const unhealthy = await startMock({ KANTHORD_MOCK_UNHEALTHY: "1" });
    try {
      const answer = await makeClient(unhealthy).call("GET", "/api/liveness", { token: null });

      expect(answer.status).toBe(503);
      expect(answer.problems).toEqual([]);
    } finally {
      await stopMock(unhealthy);
    }
  }, 20000);

  it("refuses an unknown mention and an agent with a built-in tool of a guest message", () => {
    expect(refusals.unknownMention).toMatchObject({
      status: 404,
      body: { error: { code: "agent.catalog.not_found", details: { mention: "Unknown" } } },
      problems: [],
    });
    expect(refusals.agentRefused).toMatchObject({
      status: 409,
      body: { error: { code: "workbench.guest.agent_refused" } },
      problems: [],
    });
  });
});
