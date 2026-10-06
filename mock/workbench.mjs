const WAIT_WINDOW_MS = 25000;
const WORD_DELAY_MS = 150;
const STEP_DELAY_MS = 400;
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const EFFORTS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const sessionId = () => {
  let tail = "";
  for (let index = 0; index < 25; index += 1) {
    tail += ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)];
  }
  return `workbench_session_0${tail}`;
};

const textMessage = (role, text) => ({ role, content: [{ type: "text", text }] });

const textOf = (message) =>
  typeof message?.content === "string"
    ? message.content
    : (message?.content ?? []).map((block) => block.text ?? "").join("");

export function registerWorkbench({ on, json, envelope, agents, sessions }) {
  const live = new Map();
  let entrySequence = 100;

  const stateOf = (session) => {
    if (!live.has(session.id)) {
      live.set(session.id, {
        run: null,
        streamingMessage: null,
        pendingToolCalls: [],
        pendingApproval: null,
        errorMessage: null,
        waiters: new Set(),
      });
    }
    return live.get(session.id);
  };

  const snapshotOf = (session) => {
    const state = stateOf(session);
    return {
      streamingMessage: state.streamingMessage,
      pendingToolCalls: [...state.pendingToolCalls],
      pendingApproval: state.pendingApproval,
      runActive: state.run !== null,
      errorMessage: state.errorMessage,
    };
  };

  const notify = (session) => {
    for (const wake of [...stateOf(session).waiters]) wake();
  };

  const append = (session, type, payload) => {
    const last = session.entries.at(-1);
    entrySequence += 1;
    session.entries.push({
      type,
      id: `e${String(entrySequence).padStart(7, "0")}`,
      parentId: last?.id ?? null,
      timestamp: new Date().toISOString(),
      ...payload,
    });
    notify(session);
  };

  const sleep = (run, ms) =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      run.cancel = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  const stream = async (session, run, text) => {
    const state = stateOf(session);
    const words = text.split(" ");
    for (let count = 1; count <= words.length && !run.cancelled; count += 1) {
      state.streamingMessage = {
        role: "assistant",
        content: [{ type: "text", text: words.slice(0, count).join(" ") }],
      };
      notify(session);
      await sleep(run, WORD_DELAY_MS);
    }
    state.streamingMessage = null;
    if (!run.cancelled) append(session, "message", { message: textMessage("assistant", text) });
  };

  const callTool = async (session, run, call, result) => {
    const state = stateOf(session);
    append(session, "message", {
      message: { role: "assistant", content: [{ type: "toolCall", ...call }] },
    });
    state.pendingToolCalls = [call.id];
    notify(session);
    await sleep(run, STEP_DELAY_MS);
    state.pendingToolCalls = [];
    if (run.cancelled) return;
    append(session, "message", {
      message: {
        role: "toolResult",
        toolCallId: call.id,
        toolName: call.name,
        isError: result.isError,
        content: [{ type: "text", text: result.text }],
      },
    });
  };

  const awaitApproval = (session, run, approval) =>
    new Promise((resolve) => {
      const state = stateOf(session);
      state.pendingApproval = approval;
      notify(session);
      run.decide = (approved) => {
        state.pendingApproval = null;
        run.decide = null;
        resolve(approved);
      };
      run.cancel = () => run.decide?.(false);
    });

  const play = async (session, run, text) => {
    const state = stateOf(session);
    await sleep(run, STEP_DELAY_MS);
    if (/\b(create|approve|mutation)\b/i.test(text)) {
      const call = {
        id: `call_${Date.now().toString(36)}`,
        name: "project.create",
        arguments: { name: "account-recovery" },
      };
      const approved = await awaitApproval(session, run, {
        toolCallId: call.id,
        operationId: call.name,
        input: call.arguments,
      });
      if (!run.cancelled) {
        await callTool(
          session,
          run,
          call,
          approved
            ? { isError: false, text: '{"id":"project_1"}' }
            : { isError: true, text: "The human rejected the call." },
        );
      }
    } else if (/\bfail\b/i.test(text)) {
      state.errorMessage = "The model provider refused the request.";
      return;
    } else {
      await callTool(
        session,
        run,
        { id: `call_${Date.now().toString(36)}`, name: "mission.node.list", arguments: {} },
        { isError: false, text: '{"items":[]}' },
      );
    }
    if (!run.cancelled) {
      await stream(
        session,
        run,
        "The mock daemon finished the run and answers with this scripted text.",
      );
    }
  };

  const finish = (session) => {
    const state = stateOf(session);
    state.run = null;
    state.streamingMessage = null;
    state.pendingToolCalls = [];
    state.pendingApproval = null;
    notify(session);
  };

  const find = (res, id) => {
    const session = sessions.find((candidate) => candidate.id === decodeURIComponent(id));
    if (session === undefined) {
      envelope(res, 404, "workbench.session.not_found", "The workbench session does not exist.");
    }
    return session;
  };

  const validConfiguration = (res, agentName, body) => {
    const enablement = agents.find((agent) => agent.agentName === agentName)?.enablement;
    const reasons = [];
    if (enablement?.state !== "enabled") reasons.push("The agent is not enabled.");
    if (!enablement?.agentProviders.some((p) => p.name === body?.agentProvider)) {
      reasons.push("The agent provider is unknown.");
    }
    if (typeof body?.modelIdentifier !== "string" || body.modelIdentifier === "") {
      reasons.push("The model identifier is empty.");
    }
    if (!EFFORTS.includes(body?.reasoningEffort)) reasons.push("The reasoning effort is unknown.");
    if (reasons.length === 0) return true;
    envelope(res, 422, "workbench.session.configuration_invalid", reasons.join(" "));
    return false;
  };

  on("GET", /^\/api\/workbench\/session$/, (_m, _b, res, _t, url) => {
    const agentName = url.searchParams.get("agentName");
    const items = sessions
      .filter((session) => session.agentName === agentName)
      .map((session) => {
        const messages = session.entries.filter((entry) => entry.type === "message");
        const first = messages.find((entry) => entry.message.role === "user");
        return {
          id: session.id,
          name: null,
          created: session.created,
          modified: Date.parse(session.entries.at(-1)?.timestamp ?? "") || session.created,
          messageCount: messages.length,
          firstMessage: textOf(first?.message),
        };
      });
    return json(res, 200, { items });
  });

  on("POST", /^\/api\/workbench\/session$/, (_m, body, res) => {
    if (!validConfiguration(res, body?.agentName, body)) return;
    const session = {
      id: sessionId(),
      agentName: body.agentName,
      created: Date.now(),
      configuration: {
        agentProvider: body.agentProvider,
        modelIdentifier: body.modelIdentifier,
        reasoningEffort: body.reasoningEffort,
      },
      entries: [],
    };
    sessions.push(session);
    return json(res, 200, {
      id: session.id,
      agentName: session.agentName,
      configuration: session.configuration,
      entries: [],
      runActive: false,
    });
  });

  on("GET", /^\/api\/workbench\/session\/([^/]+)$/, (m, _b, res) => {
    const session = find(res, m[1]);
    if (session === undefined) return;
    return json(res, 200, {
      id: session.id,
      agentName: session.agentName,
      configuration: session.configuration,
      entries: session.entries,
      runActive: stateOf(session).run !== null,
    });
  });

  on("PUT", /^\/api\/workbench\/session\/([^/]+)\/configuration$/, (m, body, res) => {
    const session = find(res, m[1]);
    if (session === undefined || !validConfiguration(res, session.agentName, body)) return;
    session.configuration = {
      agentProvider: body.agentProvider,
      modelIdentifier: body.modelIdentifier,
      reasoningEffort: body.reasoningEffort,
    };
    return json(res, 200, session.configuration);
  });

  on("POST", /^\/api\/workbench\/session\/([^/]+)\/message$/, (m, body, res) => {
    const session = find(res, m[1]);
    if (session === undefined) return;
    const state = stateOf(session);
    if (state.run !== null) {
      return envelope(
        res,
        409,
        "workbench.session.run_active",
        "The workbench session holds an active run.",
      );
    }
    const run = { cancelled: false, cancel: null, decide: null };
    state.run = run;
    state.errorMessage = null;
    append(session, "message", { message: { role: "user", content: body.text } });
    play(session, run, body.text).finally(() => finish(session));
    return json(res, 202, { sessionId: session.id, runActive: true });
  });

  on("POST", /^\/api\/workbench\/session\/([^/]+)\/abort$/, (m, _b, res) => {
    const session = find(res, m[1]);
    if (session === undefined) return;
    const run = stateOf(session).run;
    if (run !== null) {
      run.cancelled = true;
      run.cancel?.();
    }
    return json(res, 200, { sessionId: session.id, runActive: false });
  });

  on("POST", /^\/api\/workbench\/session\/([^/]+)\/approve$/, (m, body, res) => {
    const session = find(res, m[1]);
    if (session === undefined) return;
    const state = stateOf(session);
    if (state.pendingApproval?.toolCallId !== body?.toolCallId) {
      return envelope(
        res,
        409,
        "workbench.session.approval_not_found",
        "The session holds no pending approval for that call.",
      );
    }
    state.run.decide(body.approved === true);
    return json(res, 200, {
      sessionId: session.id,
      toolCallId: body.toolCallId,
      approved: body.approved === true,
    });
  });

  on("GET", /^\/api\/workbench\/session\/([^/]+)\/events$/, (m, _b, res, _t, url) => {
    const session = find(res, m[1]);
    if (session === undefined) return;
    const after = url.searchParams.get("after");
    const changes = () => {
      const index = after === null ? -1 : session.entries.findIndex((entry) => entry.id === after);
      return { entries: session.entries.slice(index + 1), snapshot: snapshotOf(session) };
    };
    const current = changes();
    if (current.entries.length > 0) return json(res, 200, current);
    const state = stateOf(session);
    let timer = null;
    const answer = () => {
      clearTimeout(timer);
      state.waiters.delete(answer);
      if (!res.writableEnded) json(res, 200, changes());
    };
    timer = setTimeout(answer, WAIT_WINDOW_MS);
    state.waiters.add(answer);
    res.on("close", () => {
      clearTimeout(timer);
      state.waiters.delete(answer);
    });
  });
}
