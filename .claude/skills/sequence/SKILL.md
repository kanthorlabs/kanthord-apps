---
name: sequence
description: Add or amend the `## Sequence` section of one plan document — a sequence diagram per changed path, drawn at the observable seam — and the verification gate that proves the code follows it. Binds every work item to the diagrams it changes, refuses a diagram no test can check, and refuses the permissive notation. Use when authoring a new objective, when amending one, or when a review finds an objective with no Sequence section.
---

# /sequence — the sequence diagram and its verification gate

> **Harness note.** This skill runs under Claude Code, opencode and pi from the
> one file. Where a step says "dispatch a subagent", use the harness's dispatch
> tool: `Agent` under Claude Code, `Task` under opencode, the equivalent under
> pi. Where a step names a persona file, read it from `.claude/agents/<name>.md`
> or `.opencode/agents/<name>.md`, whichever exists.

Arguments: `$ARGUMENTS` — `<plan-document-path>`. A harness that does not
substitute `$ARGUMENTS` passes the same text with the invocation; read it from
there.

**Read `STANDARD.md` beside this file first. It is the normative standard and it
is repository-neutral.** This file binds it to this repository and gives the
procedure. Where the two disagree, `STANDARD.md` wins, and the disagreement is a
defect to report.

You author two things and nothing else: the `## Sequence` section of the document
in the arguments, and the parts of its `## Acceptance criteria` and its task
documents that bind to it. Standard 4 adds the one exception: superseding a diagram edits
the earlier document's diagram and deletes its scenario file. You do not
implement, you do not run a build, and you do not commit.

**Why this exists.** A plan document states its decisions in prose, and prose
drifts from the code that ships. A sequence diagram drawn at the seam is the one
part of a plan document a machine can compare with the running code.

**What this skill is not.** It is not the mechanism that makes the standard the
default. Standard 8 names the three that are — the range gate, the declared
exemption, and the consuming skills — and this skill only produces a section that
satisfies them.

## Repository binding

This is the apps repository. `AGENTS.md` is normative for the four layers, and
the daemon contract is what the api layer mirrors. A diagram
states order across the layers and never redefines either. Every path below is
relative to the repository root.

| Concept          | Apps                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| plan document    | `.agents/plan/<initiative>/<objective>/objective.md`                                                                                                          |
| work item        | one task document under that objective's directory                                                                                                            |
| document id      | the objective directory name                                                                                                                                  |
| the seam         | the `src/api` barrel method a screen calls, and `src/api/client.ts` for the api layer                                                                         |
| participant keys | `Api<Resource>` per resource module, and `Client` or `Router` only behind their own observer                                                                  |
| the two ends     | `Screen` for the unit under test, plus `User` for an interaction and `Caller` for a hook                                                                      |
| the recorder     | `src/test/sequence/sequence-conformance.ts`, a `vi.mock` of the `src/api` barrel (`src/api/index.ts`) replacing each resource method with a recording `vi.fn` |
| a scenario       | `src/test/sequence/scenarios/<diagram-id>.ts`                                                                                                                 |
| the runner       | `src/test/sequence/conformance.test.ts`, on vitest                                                                                                            |
| the range gate   | `scripts/verify-plan-sequence.mjs` with `scripts/verify-plan-sequence.test.sh`, added to `verify:guards`                                                      |

Two rules of `AGENTS.md` decide what a diagram may draw. A screen test fakes the
`src/api` resource it calls and never fakes `fetch`, so a screen diagram's deepest
participant is a resource module and never `Client`. The interception point is the
barrel, not the resource file: a screen imports `api` from `src/api`, so the
recorder mocks that module and records the resource method it called. An api-layer diagram draws
`Client`, because `client.ts` is the single transport seam. A participant is named
per resource module — `ApiProvider`, `ApiPlan` — because one generic `Api` collides
the moment a path calls two modules.

**A recording wrapper delegates; it never replaces.** The scenario supplies the return value or the
rejection of each method, and the wrapper records the call and then calls that stub. A bare `vi.fn`
returns `undefined`, which changes the control flow under test, so the navigation or the render the
path exists to reach never happens and the trace is of a different path.

The harness story states three more properties, because each is a way a green trace becomes an
artefact of the harness: how the wrapper preserves every unrelated export of the barrel; how it
resets between scenarios, given that `vi.mock` hoists and the module cache persists; and how a
rerender or a doubled effect is recorded once.

**Two seams need two observers, and only one exists.** The barrel wrapper observes a screen calling
the api. It cannot observe the api layer calling `client.ts`, so an api-layer diagram is not drawn
until the binding declares a `Client` observer and the slice proves it. `Router` is the same case: a
`useNavigate` import is a code dependency and not an observed seam, so `Router` appears only once a
scenario renders inside a test router whose navigation the recorder wraps. Standard 3 requires a
participant to be a key the recorder saw, and a participant no observer covers is refused.

`vite.config.ts` sets `test.include` to `src/**/*.test.{ts,tsx}`, so a test file
outside `src/` never runs under `pnpm test`. The recorder, the scenarios and the
runner therefore live under `src/test/sequence/` and never under the top-level
`test/` directory, which holds `setup.ts` and the helpers.

A component test queries by role, label or text, so the terminal names what the user can observe,
and the harness derives it from the settled screen: `render:<accessible name>`,
`disabled:<accessible name>`, or `navigate:<route>` where a router observer exists. **The terminal
never carries an `ApiError` code.** Standard 7 says a trace does not prove a refusal code, so a
refusal path's terminal is the message the screen shows, and the code that produced it is asserted by
the screen's own test. A route and an accessible name are matched as exact strings, and the harness
story states the escaping rule for both.

**A diagram is drawn here only where the call order is an acceptance property.** Most screen
behaviour is state and causality — what shows while pending, which control is disabled, whether a
stale response is ignored, whether the navigation happens only after success — and a trace carries
none of it. A one-call screen adds nothing over asserting that the call happened, and making its
incidental order authoritative would block a legitimate React refactor. A path earns a diagram when
its order is the product statement: authenticate, then mutate, then refresh, then navigate. Every
other path states its behaviour in the task, as a component test and a decision table, and the
objective records `Sequence: not applicable — <reason>` when no path earns one.

**This binding is provisional until a prototype proves it.** Standard 9 requires a
slice before the standard is required anywhere, and in this repository the slice
must cover eight things, because each one can invalidate the binding: one success path; one refusal;
a navigation; a path calling two resource modules; a path calling one method twice, to prove the
projection separates them; isolation, by running two scenarios in one file and asserting neither sees
the other's calls; a mutation that adds one call and a mutation that swaps two, each asserted to
fail; and a rerender, asserted to record the call once. A screen path is asynchronous, so the recorder records the call
and the scenario awaits the settled screen before it compares — which is call
order over one settled render, and is not causality. Where two requests are
legitimately concurrent, apply the concurrency rule of standard 1: the task asserts the call set,
the objective says in one sentence that the order is not fixed and why, and no diagram is drawn. A
reviewer checks that sentence, because the gate sees it and not the assertion. Do not add sequencing
to production to satisfy a
diagram. Raise `Standard-version` and rewrite this table from what the slice
teaches.

The gate's range is explicit data, per standard 9, and this repository has no epic numbering to
derive one from. The harness task therefore declares the range as a manifest of objective directory
names, inside the script beside its own guard test, and the gate refuses an objective in the manifest
and ignores every objective outside it. `verify:guards` runs `bash scripts/<name>.test.sh` pairs, so
the gate follows that shape and joins the chain only when every objective in its manifest satisfies
it.

The runner is one cross-cutting test, so it sits beside no unit. `AGENTS.md` co-locates a test with
the unit it covers, and this is the one exception: state it in the harness task, because an unstated
exception is how a rule stops meaning anything.

## Step 1 — Parse and pre-flight

1. First positional is the plan document path. Missing, unreadable, or outside
   the plan tree of the binding table: print usage and stop.
2. The document holds `## Acceptance criteria`, and its directory holds the task
   documents that implement it. Missing either: stop and say which. This skill
   amends an objective; it does not author one, and it cannot run against an
   empty directory.
3. A `## Sequence` section already present means you **amend** it. Read it first,
   keep every live diagram id stable, and never rename or renumber an id another
   document references.
4. The document moves no seam at all: write `Sequence: not applicable — <reason>`
   in place of the section, per standard 8, report it, and stop.

## Step 2 — Decide the paths, before drawing anything

Read the objective, its `## Acceptance criteria` and every task document under
it, and list every path whose seam set or seam order the document changes. Apply the
drawing rules of standard 1: one diagram per success branch, one per refusal that
stops at a step no drawn refusal stops at, one per nested unit plus its
zero-effect path where the document claims one, and no diagram for a path whose
order is legitimately not fixed.

Refuse to continue if a path's branch set is not decidable from the document.
That is a planning defect: report it and stop, rather than drawing a block that
admits two traces.

State in the section, in one sentence per operation, that the drawn set is every
branch of that path. Standard 7 says a fixture proves no such thing, so the claim
is prose a reviewer checks, and it must be visible to be checked.

## Step 3 — Map the real seams, read-only

Dispatch a read-only explorer subagent per screen or api module in scope, all in one message
so they run concurrently. Ask each for, and require it to return:

- every `src/api` resource function that unit calls, at `file:line`;
- the current ordered seam calls of the path, quoted, at `file:line`;
- which seam calls a task of this objective adds, moves or removes;
- every seam call the tasks imply that no resource function declares yet.

Tell each explorer: **map what exists, do not propose changes.**

A seam the objective needs and no resource function declares is a decision this
objective now owns. Add a task carrying the function signature, its operation id
and its cases, and record the seam name in the section. Do not let a contract
decision stay implicit in a diagram.

The explorer's "current ordered seam calls" are what separate a context token
from a change, which standard 6 needs. Do not sign a token from memory.

## Step 4 — Write the section

Order:

1. the preamble, with the precedence rule and its limit from standard 5;
2. "What a diagram may say", carrying standards 1 to 4;
3. the addressing rule and the global-uniqueness rule of standard 3;
4. the work-item binding of standard 6;
5. the supersession rule of standard 4;
6. "What a diagram does not prove", from standard 7;
7. the seams the diagrams name that the stories did not;
8. the diagrams, each under its backticked id, each preceded by the fixture it
   assumes, each followed by the sentences that say what its shape asserts.

Every diagram is a `mermaid` fenced block declaring its participants and its
messages in the token grammar of standard 3.

## Step 5 — Bind the tasks and the gate

1. Add the `Diagrams:` and signed `Seams:` lines to every task that moves a seam,
   per standard 6, and add the scenario file paths to those tasks.
2. Add the harness, the runner and the range-gate tasks if the repository does
   not hold them yet, and add the five-case slice proof of the binding above to
   the harness task.
   Once they exist, a later document adds none of them.
3. Extend the objective's `## Acceptance criteria` and the `Verify` line of each
   owning task with the harness test, the runner and the range-gate test, and add one hermetic-coverage bullet per
   property: the replay by equality, the parser refusals, the four
   mutation-detection cases, each branch pair the diagrams separate, the decision
   table for precedence, the settled-render case, the two-direction work-item
   binding, and the range-gate refusals.

## Step 6 — Self-check, and prove it

Run `node scripts/verify-plan-sequence.mjs` when it exists. When it does not,
perform its checks yourself over the document you just wrote and report each
result:

1. every backticked `###` heading holds one `sequenceDiagram`, and its ordinals
   are dense from 1;
2. no diagram repeats a token, and no diagram holds `loop` or `opt`;
3. every diagram states one terminal, or ends with a well-formed pinned-tail
   note;
4. every diagram id is unique across every document in the gate's range;
5. every live diagram is named by exactly one `Diagrams:` line, and every
   `Diagrams:` id exists and is not superseded;
6. every `Seams:` token carries one sign, a `+` or `~` token appears in a diagram
   that task names, a `-` token appears in no live diagram, and every token new to
   the range is `+` in exactly one task;
7. every task owning a diagram holds the exact scenario path for it;
8. every `Supersedes:` names a document and an id that resolve, and the
   superseded diagram carries its `Superseded by:` line and has no scenario file.

A failure here is yours to fix before you report, not the reader's to find.

## Step 7 — Report

Print the diagram ids you wrote with their owning task, the seam names this
document now owns, and every open item as a bullet list in the house format:

```text
<B1/S1> - status:<FIXED/OPEN> - action:<YES/NO> - <name> - <description> - fix:<recommended change> - why:<reason>
```

Report a behaviour question the diagrams exposed as a blocker, not as a note. A
diagram that forces a decision the prose avoided is this skill working, and the
human decides it.

Do **not** commit — the human reviews and commits.

## What this skill refuses

- a diagram message that is not a seam call;
- `loop`, `opt`, or any notation that admits more than one trace;
- a diagram for a path whose order is legitimately concurrent, in place of the
  set or partial-order assertion standard 1 requires;
- a diagram with no scenario file, and a scenario file with no diagram;
- an unsigned `Seams:` token, and a context token declared as a change;
- a task that moves a seam and declares no `Seams:` line;
- a gate bullet that claims a property the trace does not prove, in particular
  "the operation wrote nothing" and "every branch is drawn";
- renaming or renumbering a live diagram id another document references;
- editing production code, a test, or any document other than the one in the
  arguments and the one diagram a supersession retires.
