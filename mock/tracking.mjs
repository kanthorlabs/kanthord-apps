const WINDOW_FLOOR_MS = 60_000;
const ENTRY_STEP_MS = 1000;
const SORT_KEYS = ["started_at", "duration_ms", "total_tokens", "cost_usd"];
const PHASES = [
  ["prepare", 0, 0.08],
  ["start", 0.08, 0.12],
  ["tasks", 0.12, 0.92],
  ["finish", 0.92, 1],
];
const TURN_WINDOWS = [
  [0.14, 0.34],
  [0.36, 0.56],
  [0.58, 0.88],
];
const TOOL_WINDOWS = [
  [0.2, 0.3],
  [0.42, 0.52],
];
const TOOLS = [
  ["read_file", { path: "src/index.ts" }, "export const answer = 42;"],
  ["run_command", { command: "pnpm run typecheck" }, "tsc --noEmit finished without output."],
];
const SYSTEM_PROMPT = "You are a software engineer. Work on one task and report the result.";
const LAYER_PROMPT = "The repository follows the architecture rules of AGENTS.md.";
const VERIFICATION_COMMAND = "pnpm run verify";
const VERIFICATION_OUTPUT = "Test Files  12 passed (12)\n     Tests  94 passed (94)";
const TRUNCATED_TEXT = "The command printed a long log. The daemon keeps only the first part of it";

const hex8 = (text) => {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash = Math.imul(hash ^ char.codePointAt(0), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const stateOfRecord = (record) => {
  if (record.claim_state === "running") return "open";
  if (record.stop !== null || record.claim_state === "lost") return "error";
  return "ok";
};

const usageOf = (index) => {
  const input = 1800 + 600 * index;
  const output = 240 + 90 * index;
  return {
    input,
    output,
    cacheRead: 900 * index,
    cacheCreation: index === 0 ? 400 : 0,
    cost: Number((input * 0.000003 + output * 0.000015).toFixed(6)),
  };
};

const buildEntries = (record, traceId, selection) => {
  const callId = (index) => `call_${hex8(`${traceId}:call:${index}`)}`;
  const message = (body, toolCallId = null, truncated = false) => ({
    payload: { type: "message", message: body },
    toolCallId,
    truncated,
  });
  const plain = (payload) => ({ payload, toolCallId: null, truncated: false });
  const turns = TURN_WINDOWS.flatMap((_window, index) => {
    const tool = TOOLS[index];
    const call =
      tool === undefined
        ? []
        : [{ type: "toolCall", id: callId(index), name: tool[0], arguments: tool[1] }];
    const assistant = message(
      {
        role: "assistant",
        content: [
          { type: "text", text: `Turn ${index + 1} of ${record.node_id}.` },
          { type: "thinking", thinking: `Plan the step ${index + 1} before the action.` },
          ...call,
        ],
        model: selection.model_identifier,
      },
      tool === undefined ? null : callId(index),
    );
    if (tool === undefined) return [assistant];
    return [
      assistant,
      message(
        {
          role: "toolResult",
          toolCallId: callId(index),
          toolName: tool[0],
          isError: false,
          content: [{ type: "text", text: tool[2] }],
        },
        callId(index),
      ),
    ];
  });
  return [
    plain({
      type: "model_change",
      provider: selection.provider,
      modelId: selection.model_identifier,
    }),
    plain({ type: "thinking_level_change", thinkingLevel: selection.reasoning_effort }),
    plain({
      type: "custom",
      customType: "kanthord.pinned_context",
      data: { part: "system_prompt", text: SYSTEM_PROMPT },
    }),
    plain({
      type: "custom",
      customType: "kanthord.pinned_context",
      data: { part: "layer", index: 1, text: LAYER_PROMPT },
    }),
    message({
      role: "system",
      sections: [
        { title: "System prompt", text: SYSTEM_PROMPT },
        { title: "Layer 1", text: LAYER_PROMPT },
      ],
    }),
    message({
      role: "user",
      content: [{ type: "text", text: `Work on the node ${record.node_id}.` }],
    }),
    ...turns,
    plain({
      type: "model_change",
      provider: selection.provider,
      modelId: selection.model_identifier,
    }),
    message({ role: "assistant", content: [{ type: "text", text: TRUNCATED_TEXT }] }, null, true),
  ];
};

const buildTrace = (record, now) => {
  const traceId = record.trace_id;
  const state = stateOfRecord(record);
  const selection = record.agent_selections[0];
  const worker = record.claimant.resource_identity.split(":").at(-1);
  const start = record.created_at;
  const end =
    state === "open"
      ? null
      : Math.max(record.ended_at ?? record.expired_at, start + WINDOW_FLOOR_MS);
  const window = Math.max((end ?? now) - start, WINDOW_FLOOR_MS);
  const at = (fraction) => Math.round(start + fraction * window);
  const entryIdOf = (index) => hex8(`${traceId}:entry:${index}`);
  const spans = [];

  const add = (operation, parent, from, to, attributes = {}, extra = {}) => {
    const spanId =
      spans.length === 0
        ? record.root_span_id
        : `${record.root_span_id.slice(0, 8)}${spans.length.toString(16).padStart(8, "0")}`;
    spans.push({
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parent,
      producer: operation.split(".")[0],
      origin: parent === null ? "asserted" : "observed",
      operation,
      start_time: at(from),
      end_time: to === null ? null : at(to),
      status: to === null ? "Unset" : "Ok",
      attributes: { "kanthord.worker.name": worker, ...attributes },
      events: [],
      links: [],
      text_ids: [],
      created_at: at(from),
      ...extra,
    });
    return spanId;
  };

  const root = add("scheduler.execution", null, 0, state === "open" ? null : 1);
  const phases = Object.fromEntries(
    PHASES.map(([name, from, to]) => [
      name,
      add("worker.phase", root, from, to, { "kanthord.phase": name }),
    ]),
  );
  const task = add("worker.task", phases.tasks, 0.12, 0.92);
  const session = add("agent.session", task, 0.13, state === "open" ? null : 0.89, {
    "gen_ai.agent.name": selection.agent_name,
    "kanthord.agent.name": selection.agent_name,
    "gen_ai.request.model": selection.model_identifier,
    "kanthord.session.format": "pi",
  });
  const turns = TURN_WINDOWS.map(([from, to], index) => {
    const usage = usageOf(index);
    const last = index === TURN_WINDOWS.length - 1;
    const failed = last && state === "error";
    return add(
      "agent.turn",
      task,
      from,
      last && state === "open" ? null : to,
      {
        "gen_ai.conversation.id": session,
        "gen_ai.usage.input_tokens": usage.input,
        "gen_ai.usage.output_tokens": usage.output,
        "gen_ai.usage.cache_read.input_tokens": usage.cacheRead,
        "gen_ai.usage.cache_creation.input_tokens": usage.cacheCreation,
        "kanthord.usage.cost_usd": usage.cost,
        "gen_ai.response.model": selection.model_identifier,
        "kanthord.session.entry_id": entryIdOf(6 + 2 * index),
        ...(failed ? { "error.type": "rate_limited" } : {}),
      },
      failed ? { status: "Error" } : {},
    );
  });
  TOOL_WINDOWS.forEach(([from, to], index) => {
    add("agent.tool", turns[index], from, to, {
      "gen_ai.conversation.id": session,
      "gen_ai.tool.name": TOOLS[index][0],
      "gen_ai.tool.call.id": `call_${hex8(`${traceId}:call:${index}`)}`,
    });
  });
  const texts = [VERIFICATION_COMMAND, VERIFICATION_OUTPUT].map((content, index) => ({
    trace_id: traceId,
    text_id: `text_${hex8(`${traceId}:text:${index}`)}`,
    content,
    created_at: at(0.92),
  }));
  add("worker.verification", task, 0.89, 0.92, {}, { text_ids: texts.map((text) => text.text_id) });
  add("worker.git", phases.finish, 0.93, 0.99, { "kanthord.git.step": "commit" });

  const sessionStart = at(0.13);
  const entries = buildEntries(record, traceId, selection).map((raw, index) => {
    const entryTime = sessionStart + index * ENTRY_STEP_MS;
    const id = entryIdOf(index);
    return {
      trace_id: traceId,
      session_id: session,
      entry_id: id,
      parent_entry_id: index === 0 ? null : entryIdOf(index - 1),
      sequence: index,
      entry_type: raw.payload.type,
      entry_time: entryTime,
      tool_call_id: raw.toolCallId,
      truncated: raw.truncated,
      entry: {
        id,
        parentId: index === 0 ? null : entryIdOf(index - 1),
        timestamp: new Date(entryTime).toISOString(),
        ...raw.payload,
      },
      created_at: entryTime,
    };
  });

  const turnSpans = spans.filter((span) => span.operation === "agent.turn");
  const sum = (key) => turnSpans.reduce((total, span) => total + span.attributes[key], 0);
  const errorSpans = spans.filter((span) => span.status === "Error");
  const inputTokens = sum("gen_ai.usage.input_tokens");
  const outputTokens = sum("gen_ai.usage.output_tokens");
  const summary = {
    trace_id: traceId,
    project_id: record.project_id,
    execution_id: record.execution_id,
    node_id: record.node_id,
    attempt: record.attempt,
    root_span_id: record.root_span_id,
    created_at: record.created_at,
    state,
    started_at: start,
    ended_at: end,
    duration_ms: end === null ? null : end - start,
    stop_reason: record.stop?.reason ?? null,
    worker_name: worker,
    agent_names: [selection.agent_name],
    models: [selection.model_identifier],
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: sum("gen_ai.usage.cache_read.input_tokens"),
    cache_creation_tokens: sum("gen_ai.usage.cache_creation.input_tokens"),
    total_tokens: inputTokens + outputTokens,
    cost_usd: Number(sum("kanthord.usage.cost_usd").toFixed(6)),
    span_count: spans.length,
    turn_count: turnSpans.length,
    tool_count: spans.filter((span) => span.operation === "agent.tool").length,
    error_count: errorSpans.length,
    error_types: [...new Set(errorSpans.map((span) => span.attributes["error.type"]))],
    first_error_span_id: errorSpans.find((span) => span.parent_span_id !== null)?.span_id ?? null,
  };
  return { summary, spans, texts, entries };
};

const matchesQuery = (summary, text) => {
  const needle = text.toLowerCase();
  return [
    summary.trace_id,
    summary.project_id,
    summary.execution_id,
    summary.node_id,
    summary.worker_name,
    ...summary.agent_names,
    ...summary.models,
  ].some((field) => field?.toLowerCase().includes(needle));
};

const matchesFilters = (summary, params) => {
  const exact = (name, field) => params.get(name) === null || params.get(name) === field;
  const member = (name, fields) => params.get(name) === null || fields.includes(params.get(name));
  const from = params.get("started_from");
  const text = params.get("q");
  return (
    exact("project_id", summary.project_id) &&
    exact("node_id", summary.node_id) &&
    exact("execution_id", summary.execution_id) &&
    exact("worker_name", summary.worker_name) &&
    exact("state", summary.state) &&
    member("agent_name", summary.agent_names) &&
    member("model", summary.models) &&
    member("error_type", summary.error_types) &&
    (from === null || (summary.started_at !== null && summary.started_at >= Number(from))) &&
    (text === null || matchesQuery(summary, text))
  );
};

const sortOf = (params) => {
  const requested = params.get("sort");
  return SORT_KEYS.includes(requested) ? requested : "started_at";
};

const uniqueSorted = (lists) => [...new Set(lists.flat())].sort();

export function registerTracking({ on, json, envelope, page, executions }) {
  const now = Date.now();
  const traces = () => executions().map((record) => buildTrace(record, now));

  const find = (res, traceId) => {
    const trace = traces().find((item) => item.summary.trace_id === traceId);
    if (trace === undefined) {
      envelope(res, 404, "tracking.trace.not_found", "The trace is unknown or expired.");
    }
    return trace;
  };

  on("GET", /^\/api\/tracking\/trace$/, (_m, _b, res, _t, url) => {
    const key = sortOf(url.searchParams);
    const items = traces()
      .map((trace) => trace.summary)
      .filter((summary) => matchesFilters(summary, url.searchParams))
      .sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || b.trace_id.localeCompare(a.trace_id));
    return json(res, 200, page(items, url));
  });

  on("GET", /^\/api\/tracking\/facet$/, (_m, _b, res, _t, url) => {
    const projectId = url.searchParams.get("project_id");
    const summaries = traces()
      .map((trace) => trace.summary)
      .filter((summary) => projectId === null || summary.project_id === projectId);
    return json(res, 200, {
      worker_names: uniqueSorted(summaries.map((summary) => summary.worker_name ?? [])),
      agent_names: uniqueSorted(summaries.map((summary) => summary.agent_names)),
      models: uniqueSorted(summaries.map((summary) => summary.models)),
      error_types: uniqueSorted(summaries.map((summary) => summary.error_types)),
    });
  });

  on("GET", /^\/api\/tracking\/trace\/([^/]+)$/, (m, _b, res) => {
    const trace = find(res, decodeURIComponent(m[1]));
    if (trace !== undefined) json(res, 200, trace.summary);
  });

  on("GET", /^\/api\/tracking\/trace\/([^/]+)\/span$/, (m, _b, res, _t, url) => {
    const trace = find(res, decodeURIComponent(m[1]));
    if (trace !== undefined) json(res, 200, page(trace.spans, url));
  });

  on("GET", /^\/api\/tracking\/trace\/([^/]+)\/text\/([^/]+)$/, (m, _b, res) => {
    const trace = find(res, decodeURIComponent(m[1]));
    if (trace === undefined) return;
    const text = trace.texts.find((item) => item.text_id === decodeURIComponent(m[2]));
    if (text === undefined) {
      return envelope(res, 404, "tracking.text.not_found", "The text is unknown or expired.");
    }
    json(res, 200, text);
  });

  on("GET", /^\/api\/tracking\/trace\/([^/]+)\/session\/([^/]+)\/entry$/, (m, _b, res, _t, url) => {
    const trace = find(res, decodeURIComponent(m[1]));
    if (trace === undefined) return;
    const toolCallId = url.searchParams.get("tool_call_id");
    const items = trace.entries.filter(
      (entry) =>
        entry.session_id === decodeURIComponent(m[2]) &&
        (toolCallId === null || entry.tool_call_id === toolCallId),
    );
    json(res, 200, page(items, url));
  });

  on("GET", /^\/api\/tracking\/trace\/([^/]+)\/session\/([^/]+)\/entry\/([^/]+)$/, (m, _b, res) => {
    const trace = find(res, decodeURIComponent(m[1]));
    if (trace === undefined) return;
    const entry = trace.entries.find(
      (item) =>
        item.session_id === decodeURIComponent(m[2]) && item.entry_id === decodeURIComponent(m[3]),
    );
    if (entry === undefined) {
      return envelope(res, 404, "tracking.entry.not_found", "The entry is unknown or expired.");
    }
    json(res, 200, entry);
  });
}
