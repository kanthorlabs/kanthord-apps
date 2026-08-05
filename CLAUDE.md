# KanthorD

A Flutter control surface for the kanthord daemon, which is a plan-and-DAG execution engine. A human
imports a plan of initiative, objective and task nodes; the daemon runs a scheduler pass, a coding agent
executes a task, and a reviewer agent judges it. The client drives that engine and reads what it did.

**It is not a chat client.** The MVP has no conversational surface: the daemon ships no route that
accepts a prompt and no route that streams. Read `docs/api/blockers.md` R1 for the invariant. Build no
chat page, no prompt box, no message list, and no `AgentEvent` type.

The client shows lifecycle progress by polling the event log with a cursor, and it opens a completed
prompt, diff or check log from a blob. It never renders live agent output, because nothing in this
product produces any.

Six platforms: iOS, Android, macOS, Windows, Linux, web.

| Parameter    | Value                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Package name | `kanthord`                                                                    |
| Display name | `KanthorD`                                                                    |
| Organization | `com.kanthorlabs.kanthord`                                                    |
| Flutter      | 3.44.8, pinned in `.fvmrc`                                                    |
| API base URL | No default. The human enters it, per install. Read `docs/api/connectivity.md` |

## Where the rules live

| Document                                   | Holds                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                | Architecture, naming, stack, commits, current state                                           |
| `DESIGNS.md`                               | Design rules: Material 3 only, the `KD` prefix, atomic layering, tokens, layout family, input |
| `docs/operations.md`                       | Commands, building, platform specifics, lints, formatting, codegen, dependencies, secrets     |
| `docs/testing.md`                          | Test layout, structure, what to mock, SDK and design system test cases                        |
| `HANDOFF.md`                               | Deferred work and the open questions that block it                                            |
| `lib/libraries/kd_design_system/README.md` | Token values and the component list                                                           |

Read the specific document before you work in its area. Do not restate its rules here.

## How to read this document

This document mixes three kinds of statement. Check which one you are reading before you act.

| Kind       | Meaning                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| **State**  | A fact about the repository right now. The "Current state" section holds these                                     |
| **Target** | The structure code must take when it is written. The `lib/api/` and feature sections are targets, not descriptions |
| **Policy** | A rule that binds every contributor and every agent                                                                |

A target section describes code that does not exist yet. Do not read it as a description of the
tree.

## Current state

Built and verified:

- Project scaffold with all six platform targets.
- Tooling: `Makefile`, `.fvmrc`, `analysis_options.yaml`, `build.yaml`, commitlint plus husky.
- `lib/libraries/kd_design_system/`: tokens, layout family, `KDText`, `KDCard`, `KDCardList`,
  `KDAdaptiveScaffold`, and `KDGalleryPage`.
- `lib/app/kanthord_app.dart`: the root widget.

Verified builds on a Mac host: macOS, web, iOS, Android. **Windows and Linux have never been
compiled.**

There is no CI. It is deferred until the MVP lands, so every check is local and manual. Run
`make format-check`, `make analyze`, and `make test` before you push.

Not written yet: `lib/api/`, `lib/features/`, `lib/gen/`, `.env.staging`, `.env.production`,
`lib/app/env/`. Read `HANDOFF.md` for the deferred work and its open questions.

### Bootstrap exceptions

The app has no feature and no server call yet, so two policies below are not yet met. Both are
deliberate and both end when the first feature lands.

- `lib/app/kanthord_app.dart` uses `MaterialApp` with `home: KDGalleryPage(...)`. It does not use
  `go_router`. Replace this with the router when the first feature route exists.
- `build.yaml` points `generate_for` at paths that do not exist yet, so `make generate` writes no
  output. This is correct for the current tree.

## When a rule says "ask first"

Several rules require approval: a new dependency, a new layer, a third layout family, a change to the
polling cadence or its restart position. The approver is the repository owner.

An agent that cannot reach the owner must stop at that boundary and report the blocker. Do not
assume approval, and do not pick a default and continue.

## Architecture: two layers

Single package. Relative imports inside `lib/`. Use `package:` only for the Flutter SDK and
third-party code.

```
lib/
├── app/            # entry point, bootstrap, DI, router, root widget
├── api/            # the backend SDK: one typed client for the whole REST API
├── features/       # UI only: bloc, state, page, widgets
├── libraries/      # kd_design_system, core utilities
└── gen/            # generated assets
```

The SDK is one layer. The UI is the other layer. There is nothing between them.

### Do not build Clean Architecture

Write no use case class. Write no repository interface. Write no repository implementation.
Write no entity-plus-DTO pair.

One model serves the wire and the UI. A bloc calls the SDK directly.

Add a layer only when a real second consumer appears, and ask first.

### The SDK: `lib/api/`

```
api/
├── api.dart                  # barrel export
├── kanthord_api.dart         # the client: holds Dio, exposes the resource groups
├── api_exception.dart        # sealed exception hierarchy
├── api_config.dart           # base URL per platform, timeouts, headers
├── token_provider.dart       # abstract TokenProviderType, Dart only
├── interceptors/             # auth, retry, logging
├── sse/                      # streaming client, native and web
├── models/                   # @freezed + @JsonSerializable, one file per model
└── resources/                # one file per API resource group
```

Rules:

- `lib/api/` imports nothing from `lib/features/`, `lib/app/`, or `lib/libraries/`. The
  dependency runs one way.
- The SDK knows nothing about Flutter. It imports no widget, no bloc, and no Flutter plugin. This
  keeps it testable and keeps it extractable into its own package later.
- One resource class per REST resource group. Group by the server path, not by the screen.
- One method maps to one endpoint. Name it after the action: `list`, `get`, `create`, `update`,
  `delete`, `send`, `stream`.
- A method returns the model, or `Stream<T>` when the endpoint streams. It never returns a raw
  `Response` and never returns a `Map`.
- A method throws a typed `ApiException`. It never returns an error object. Do not use `Either`
  and do not use `Result`.
- Models live in `models/` and are shared by every resource. Do not duplicate a model per
  feature.
- The SDK reads no storage. Token access goes through `TokenProviderType`. The app layer
  implements it and registers it in `get_it`.
- `KanthordApi` takes an optional `Dio`. It builds a default one when the caller passes none. A
  test passes a `Dio` with a mock adapter. Do not construct `Dio` inside a resource class.
- Register `KanthordApi` one time in `get_it` as a lazy singleton.

The base URL is not one constant. Read `docs/operations.md` for the per-target host table and the
HTTP transport limits.

`lib/api/README.md` will hold the resource table and the transport rules. It is written with the
SDK, so it does not exist yet.

### A feature: `lib/features/<name>/`

```
features/<name>/
├── <name>.dart              # barrel: routes only
├── <name>_routes.dart       # go_router typed routes
└── <screen>/
    ├── <screen>_bloc.dart   # takes KanthordApi in the constructor
    ├── <screen>_state.dart  # @freezed sealed class
    ├── <screen>_page.dart
    └── widgets/
```

- The bloc holds the logic. It calls the SDK, maps the result to state, and maps an
  `ApiException` to an error state.
- The route creates the bloc and passes `getIt<KanthordApi>()`. Add no `Dependencies` file.
- The page reads state and renders `KD` components. The page contains no API call.
- Use `go_router` for every navigation. Do not use `Navigator.push`. Declare every route with
  `@TypedGoRoute` in `<name>_routes.dart`.

Feature code builds pages only. It defines no atom and hard-codes no design value. Read
`DESIGNS.md`.

## Stack

| Concern              | Choice                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| State management     | `flutter_bloc` + `freezed` sealed states                                                  |
| Dependency injection | `get_it`                                                                                  |
| Routing              | `go_router` + `go_router_builder` typed routes                                            |
| HTTP                 | `dio` with interceptors for auth, retry, idempotency, and logging                         |
| Progress             | Long polling `event.list` with a cursor. **Not SSE.** Read `docs/api/polling.md`          |
| Serialization        | `json_serializable`, no `fieldRename`, `@JsonKey(name:)` per field. The wire is camelCase |
| Web interop          | None. Nothing streams, so `package:web` is not needed                                     |
| Secrets              | `envied`. `.env.staging` and `.env.production` are not written yet                        |
| Token storage        | `flutter_secure_storage` on native, memory on web                                         |
| Settings storage     | `shared_preferences`                                                                      |
| Logging              | `logger`                                                                                  |
| Codegen              | `build_runner`, `freezed`, `json_serializable`, `go_router_builder`                       |
| Lints                | `flutter_lints`                                                                           |
| Tests                | `flutter_test`, `mockito`                                                                 |

Add no dependency without approval. Read `docs/operations.md` for the version pins and the reason
behind them.

## Naming

| Element               | Convention                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Files                 | `snake_case.dart`                                                                         |
| Concrete classes      | `final class`. A `State` subclass stays a plain `class`, because the framework extends it |
| Class hierarchies     | `sealed class`                                                                            |
| Abstract interfaces   | `<Name>Type` suffix                                                                       |
| Implementations       | no suffix                                                                                 |
| SDK resource groups   | `<Name>Resource`, exposed as `api.<name>`                                                 |
| SDK models            | `<Name>` for a payload, `<Action><Name>Request` for a request body                        |
| Blocs                 | `<Feature>Bloc`, state `<Feature>State`                                                   |
| Design system symbols | `KD` prefix on every exported symbol. Read `DESIGNS.md` for the scope                     |
| Private constants     | `_kCamelCase`                                                                             |

## Commits

Format: `type(scope): subject`.

```
feat(api): add the sessions resource
fix(sse): join a multiline data field in order
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `style`, `perf`, `ci`, `build`.

The subject starts lower case and takes no trailing period. The header caps at 100 characters. The
scope is optional.

`commitlint` runs in a husky `commit-msg` hook. It needs Node. Commit linting is optional for a
contributor without Node, and `make bootstrap` prints a skip message.

Branch: `type/short-description`, using the same type list. Lower case, hyphen separated.

```
^(feat|fix|chore|refactor|test|docs|style|perf|ci|build)/[a-z0-9]+(-[a-z0-9]+)*$
```

```
chore/project-scaffold
feat/daemon-connect
fix/event-poller-cursor
```

Nothing enforces the pattern now that CI is removed.

## Repository state

`pubspec.lock` and every generated file (`*.g.dart`, `*.freezed.dart`) are committed, so a fresh
clone analyzes and tests without running codegen first. Run `make generate` and commit the result
whenever you change a model, a state class, or a route.
