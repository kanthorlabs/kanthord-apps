# Operations

Every operation the daemon declares. Provenance is [README.md](README.md).

## The three columns that matter

- `phase` — the daemon phase that implements the behaviour.
- `declared` — `routed` or `stubbed` in the engine registry.
- `today` — what a request gets from the daemon at commit `a5b957d`.

`live` answers a real response. `501` answers the error envelope with code `not-implemented` and
writes no state. A path absent from this table answers `404 not-found` and never ships in this
version.

## What the daemon is

A plan-and-DAG execution engine. A human imports a plan of `initiative`, `objective` and `task`
nodes. The daemon runs a scheduler pass, a coding agent executes a task, and a reviewer agent judges
it. Every transition writes an event.

**Only a human mutates the graph**, through this API or through export, edit and re-import. No route
accepts a state field. The daemon owns state, so the client never writes one. Every transition is an
action route — `unblock`, `waive`, `abandon`, `discard`, `approve` — never a field update.

## System

| operationId     | Method and path      | phase | declared | today    |
| --------------- | -------------------- | ----- | -------- | -------- |
| `system.health` | `GET /v1/health`     | 1     | routed   | **live** |
| `system.db`     | `GET /v1/db/status`  | 1     | routed   | **live** |
| `system.status` | `GET /v1/status`     | 1     | routed   | 501      |
| `blob.show`     | `GET /v1/blob/:hash` | 1     | routed   | 501      |

`system.health` and `system.db` are the only two operations with a response schema in the registry,
and the only two with a handler. Build the SDK smoke test against them.

```json
{
  "status": "degraded",
  "dependencies": [
    { "name": "storage", "status": "ok" },
    { "name": "git", "status": "failed" }
  ]
}
```

`status` is `ok` when no dependency reports `failed`, and `degraded` otherwise. A dependency reports
`ok`, `failed` or `not-implemented`, and `not-implemented` never degrades the daemon. `dependencies`
is ordered by `name`, bytewise. The HTTP status is `200` even when the body says `degraded`. Read
the body field, never the HTTP status.

```json
{
  "migrations": [{ "version": 1, "name": "initial", "applied": true, "appliedAt": 1738713600000 }]
}
```

`appliedAt` is epoch milliseconds and is nullable.

`system.status` is the route a dashboard wants: the daemon version, the bind address, the process
start time, every node by kind and state with `blockReason`, every repository in `needs-reconcile`
with both object ids, and every expired lease with its owner and fence. It has no schema and no
handler. See [blockers.md](blockers.md).

## Credential and provider

| operationId           | Method and path                | phase | declared | today |
| --------------------- | ------------------------------ | ----- | -------- | ----- |
| `provider.list`       | `GET /v1/provider`             | 1     | routed   | 501   |
| `provider.register`   | `POST /v1/provider`            | 1     | routed   | 501   |
| `provider.show`       | `GET /v1/provider/:id`         | 1     | routed   | 501   |
| `provider.remove`     | `DELETE /v1/provider/:id`      | 2     | stubbed  | 501   |
| `provider.rename`     | `POST /v1/provider/:id/rename` | 2     | stubbed  | 501   |
| `provider.setDefault` | `PUT /v1/provider/:id/default` | 2     | stubbed  | 501   |

## Repository

| operationId                | Method and path                          | phase | declared | today |
| -------------------------- | ---------------------------------------- | ----- | -------- | ----- |
| `repository.register`      | `POST /v1/repository`                    | 1     | routed   | 501   |
| `repository.list`          | `GET /v1/repository`                     | 1     | routed   | 501   |
| `repository.show`          | `GET /v1/repository/:id`                 | 1     | routed   | 501   |
| `repository.inspect`       | `POST /v1/repository/inspect`            | 1     | routed   | 501   |
| `repository.reconcile`     | `POST /v1/repository/:id/reconcile`      | 2     | stubbed  | 501   |
| `repository.publish`       | `POST /v1/repository/:id/publish`        | 2     | stubbed  | 501   |
| `repository.landingBranch` | `POST /v1/repository/:id/landing-branch` | 2     | stubbed  | 501   |
| `profile.export`           | `GET /v1/repository/:id/profile`         | 2     | stubbed  | 501   |
| `profile.import`           | `PUT /v1/repository/:id/profile`         | 2     | stubbed  | 501   |
| `profile.instantiate`      | `POST /v1/repository/:id/profile`        | 2     | stubbed  | 501   |
| `profile.verify`           | `POST /v1/repository/:id/profile/verify` | 2     | stubbed  | 501   |

`repository.register` is the one operation whose wrong answer has a security consequence. It
re-scans the host key and compares it against a fingerprint a human confirmed. A mismatch is
`409 host-key-mismatch`. **Never retry it and never auto-confirm it.** Show the human both
fingerprints. See [errors.md](errors.md).

## Project

| operationId              | Method and path                      | phase | declared | today |
| ------------------------ | ------------------------------------ | ----- | -------- | ----- |
| `project.create`         | `POST /v1/project`                   | 1     | routed   | 501   |
| `project.list`           | `GET /v1/project`                    | 1     | routed   | 501   |
| `project.show`           | `GET /v1/project/:id`                | 1     | routed   | 501   |
| `project.repositories`   | `PUT /v1/project/:id/repository`     | 1     | routed   | 501   |
| `binding.worker.project` | `PUT /v1/project/:id/binding/worker` | 2     | stubbed  | 501   |

`project.repositories` replaces the whole list. A binding set is a value, so a partial edit has no
meaning. The MVP accepts one entry, and the daemon refuses a longer list.

## Graph

| operationId      | Method and path                      | phase | declared | today |
| ---------------- | ------------------------------------ | ----- | -------- | ----- |
| `plan.validate`  | `POST /v1/project/:id/plan/validate` | 1     | routed   | 501   |
| `plan.import`    | `POST /v1/project/:id/plan/import`   | 1     | routed   | 501   |
| `plan.export`    | `GET /v1/project/:id/plan/export`    | 1     | routed   | 501   |
| `plan.revisions` | `GET /v1/project/:id/plan/revision`  | 1     | routed   | 501   |
| `node.list`      | `GET /v1/node`                       | 1     | routed   | 501   |
| `node.show`      | `GET /v1/node/:id`                   | 1     | routed   | 501   |
| `edge.list`      | `GET /v1/project/:id/edge`           | 1     | routed   | 501   |

Import is a two-step protocol. `plan.validate` writes nothing and returns the findings, the
normalized documents with provisional identities, the document hash, the topology revision, and the
required choice set. `plan.import` then sends the same normalized documents plus `importId`,
`choices`, `validatedRevision` and `documentsHash`.

```json
{
  "fromRevision": null,
  "importId": "import_01JQ8Z7G3H",
  "documents": [{ "path": "plan/…/initiative.md", "content": "---\n…\n" }],
  "choices": [{ "id": "task_01JQ8ZAN9P", "take": "submitted" }],
  "validatedRevision": "revision_01JQ8Z7G3H",
  "documentsHash": "sha256:…"
}
```

`fromRevision` is null on a first import. `importId` is client-minted and makes the import
idempotent: the same `importId` returns the original revision and documents with `200`. The same
`importId` with a different fingerprint is `409 idempotency-mismatch` and is a client defect.

`node.list` filters are `project`, `kind`, `state`, `blockReason` and `repository`. It returns
identity, kind, title, state, block reason, discard reason, the parent, and the dependencies. It
never returns the body prose. `node.show` adds the instruction and the acceptance criteria as blob
hashes, the bound worker, the repository on an objective, and the last revision that wrote the node.

`edge.list` returns the edge id, the two node identities, and `waivedAt` when a human waived it. A
waiver is not a deletion, so render a waived edge as waived.

`node` states, block reasons and kinds are in [conventions.md](conventions.md).

## Outcome — the human controls

| operationId             | Method and path             | phase | declared | today |
| ----------------------- | --------------------------- | ----- | -------- | ----- |
| `node.unblock`          | `POST /v1/node/:id/unblock` | 2     | stubbed  | 501   |
| `node.abandon`          | `POST /v1/node/:id/abandon` | 2     | stubbed  | 501   |
| `node.approve`          | `POST /v1/node/:id/approve` | 2     | stubbed  | 501   |
| `node.approvalEvidence` | `GET /v1/node/:id/approval` | 2     | stubbed  | 501   |
| `node.discard`          | `POST /v1/node/:id/discard` | 3     | stubbed  | 501   |
| `node.waive`            | `POST /v1/node/:id/waive`   | 3     | stubbed  | 501   |

No request carries an actor. The daemon reads the actor name from its own configuration, because one
token serves one human, so a client-supplied name would be a claim rather than a fact. Do not add an
actor field and do not add an actor picker to the UI.

## Execution

| operationId     | Method and path            | phase | declared | today |
| --------------- | -------------------------- | ----- | -------- | ----- |
| `run.start`     | `POST /v1/project/:id/run` | 2     | stubbed  | 501   |
| `run.cancel`    | `POST /v1/run/:id/cancel`  | 2     | stubbed  | 501   |
| `run.list`      | `GET /v1/run`              | 2     | stubbed  | 501   |
| `run.show`      | `GET /v1/run/:id`          | 2     | stubbed  | 501   |
| `node.attempts` | `GET /v1/node/:id/attempt` | 2     | stubbed  | 501   |
| `attempt.show`  | `GET /v1/attempt/:id`      | 2     | stubbed  | 501   |
| `node.checks`   | `GET /v1/node/:id/check`   | 2     | stubbed  | 501   |
| `worker.list`   | `GET /v1/worker`           | 2     | stubbed  | 501   |

These eight are what "render agent output" means in this product. An attempt carries the attempt
number, the pinned registration and provider model, the timeout, the base and head object ids, and
an outcome of `accepted`, `rejected`, `failed`, `timed-out` or `cancelled`. Each invocation under it
carries the agent role, the adapter version, and the rendered prompt, tool definitions, tool trace
and diff **as blob hashes**, plus the reviewer verdict and the reported token usage.

`run.start` starts a scheduler pass over an imported plan. It is not a prompt. A second call while a
run is active is `409 lease-held`.

`node.attempts` returns the attempts of the active task run. `?run=<runId>` selects an earlier one.

## Instruction

| operationId            | Method and path               | phase | declared | today |
| ---------------------- | ----------------------------- | ----- | -------- | ----- |
| `agent.list`           | `GET /v1/agent`               | 2     | stubbed  | 501   |
| `instructions.resolve` | `GET /v1/instruction/resolve` | 2     | stubbed  | 501   |
| `template.list`        | `GET /v1/template`            | 2     | stubbed  | 501   |
| `template.show`        | `GET /v1/template/:id`        | 2     | stubbed  | 501   |

## Integration

| operationId         | Method and path         | phase | declared | today |
| ------------------- | ----------------------- | ----- | -------- | ----- |
| `gitOperation.list` | `GET /v1/git-operation` | 3     | stubbed  | 501   |

## Event

| operationId  | Method and path | phase | declared | today |
| ------------ | --------------- | ----- | -------- | ----- |
| `event.list` | `GET /v1/event` | 1     | routed   | 501   |

Filters are `subjectKind`, `subject`, `type`, `actorKind` and `actor`. `subject` takes a prefixed id,
so one filter serves every subject kind. Paging is a cursor: `after` takes the **id** of the last
event read, and `limit` caps the page. An offset cannot page an append-only log.

Every event carries its id, the type, the subject kind and identity, the actor kind and identity, the
payload, and a timestamp the daemon decodes from the ULID. Do not decode a ULID in the client.

**The order is total and it carries no gap information.** A ULID is not dense, so two adjacent ids
do not prove nothing is missing. Never assert a contiguous sequence.

`GET /v1/event/stream` is `post-mvp` and answers `404`. Read [polling.md](polling.md).

## The resource grouping for `lib/api/resources/`

Group by the server path, as `CLAUDE.md` requires. Nine resource classes cover all 53 operations.

| Class                 | Exposed as        | Owns                                               |
| --------------------- | ----------------- | -------------------------------------------------- |
| `SystemResource`      | `api.system`      | `system.*`, `blob.show`                            |
| `ProviderResource`    | `api.provider`    | `provider.*`                                       |
| `RepositoryResource`  | `api.repository`  | `repository.*`, `profile.*`                        |
| `ProjectResource`     | `api.project`     | `project.*`, `binding.worker.project`              |
| `PlanResource`        | `api.plan`        | `plan.*`                                           |
| `NodeResource`        | `api.node`        | `node.*`, `edge.list`                              |
| `RunResource`         | `api.run`         | `run.*`, `attempt.show`, `worker.list`             |
| `InstructionResource` | `api.instruction` | `agent.list`, `instructions.resolve`, `template.*` |
| `EventResource`       | `api.event`       | `event.list`                                       |

`plan.*` splits from `ProjectResource` even though its paths nest under `/v1/project/:id`, because
the import protocol is four operations with its own preconditions and its own idempotency rule.
`node.*` holds `edge.list` for the same reason: an edge is read only as part of a topology.

**Write no method for a `501` operation until its schema lands.** A method that returns a model the
daemon has never produced is a guess that compiles.
