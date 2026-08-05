# Handoff: deferred work

Read `CLAUDE.md` first for the architecture and the naming, `DESIGNS.md` for the design rules,
`docs/operations.md` for the commands and the platform specifics, and `docs/testing.md` for the test
conventions. This document holds what is not built and what blocks it.

Status date: 2026-08-05.

## Done and verified

| Step | Scope | Verification |
|---|---|---|
| 1 | Project scaffold, six platform targets | `flutter build macos --debug`, `flutter build web`, `flutter build ios --debug --no-codesign`, `flutter build apk --debug` all pass. Windows and Linux need CI |
| 2 | Tooling | `make analyze` clean, `make format-check` passes. Commitlint accepts `feat(api): [ENGA-123] subject` and rejects a missing ticket and an unknown type |
| 3 | KD design system: tokens, layout family, `KDText`, `KDCard`, `KDCardList`, `KDAdaptiveScaffold` | `make test` 6/6. Gallery checked on the real macOS app in light and dark, at 520 pt (`mobile`) and 1100 pt (`wide`) |

Windows and Linux were never compiled. No Windows host and no Linux host exist here.
`build-matrix.yml` is the only check for them and it has never run.

## Blocked: answers needed from the owner

Do not guess any of these. Each one blocks the work named next to it.

| Question | Blocks |
|---|---|
| The API contract: endpoints, request shapes, response shapes, SSE event names | The models, the resource classes, the SSE event type |
| The auth flow: how a user signs in, the refresh endpoint path and payload, the token lifetime | The auth interceptor, the sign-in feature |
| The LAN IP of the development machine | Running on a physical device |
| The HTTPS base URL | A production web bundle |
| The real color palette, type scale, and spacing scale from the design file | Replacing every `// TODO(tokens)` value |

## Step 4: the `lib/api/` SDK

Target layout and every rule live in `CLAUDE.md`. Verification is the `test/api/` suite.

### 4a. Buildable now, no answer needed

Roughly two thirds of step 4 does not depend on the contract. Build this first.

**`api_config.dart`** — resolve the base URL per target using the table in `CLAUDE.md`. Use
`defaultTargetPlatform` plus `kIsWeb`. Hold the connect, receive, and send timeouts.

**`api_exception.dart`** — `sealed class ApiException` with these subclasses: no network, timeout,
response error, decode error, unauthorized, cancelled. Throw them. Never return an error object.
Never use `Either` and never use `Result`.

For the web CORS case: a browser reports a CORS failure as a generic network failure with no
detail. Map it to the no-network exception and name CORS as a likely cause in the message. Do not
promise a precise CORS exception.

**`token_provider.dart`** — the Dart-only interface:

```dart
abstract class TokenProviderType {
  Future<String?> accessToken();
  Future<String?> refreshToken();
  Future<void> save({required String access, required String refresh});
  Future<void> clear();
}
```

Two implementations in the app layer, not in `lib/api/`:

- Native: `flutter_secure_storage`, which uses the keychain and the keystore.
- Web: memory only. The web build of `flutter_secure_storage` cannot match a native keychain, and
  any same-origin script reads what it holds. A web session ends when the tab closes. That is
  intended.

Never write a refresh token to `shared_preferences` and never to `localStorage`.

**`interceptors/retry_interceptor.dart`** — fully specified, no answer needed:

- Retry `GET`, `HEAD`, `PUT`, `DELETE` only. Never retry `POST`, because the server may have
  processed it.
- Retry on a connection error, on a timeout, and on 502, 503, 504. Never on another 4xx.
- Three attempts total. Backoff 200 ms then 800 ms, with jitter.
- Stop immediately when the caller cancels. A cancelled request is never retried.
- Never retry a stream.

**`sse/`** — the parser is fully specified. It is the highest-risk piece in the SDK and it needs no
contract answer, because only the event *names* are unknown, not the wire format. Build it early.

Put it behind `SseClientType` and select the implementation with a conditional import. The bloc
sees one interface.

Parser rules, all mandatory:

- A blank line dispatches the buffered event. A field line alone dispatches nothing.
- `data:` repeats. Join the values with a newline, in order.
- Accept `\n`, `\r\n`, and `\r` as line breaks.
- A line that starts with `:` is a comment. Skip it. Servers send comments as heartbeats.
- Strip one optional space after the field colon.
- Decode UTF-8 incrementally. A multi-byte character splits across two chunks. Use `utf8.decoder`
  with `allowMalformed: false` inside a `StreamTransformer`. Do not call `utf8.decode` per chunk.
- Ignore an unknown field name. Do not throw.
- Discard a trailing partial event when the stream ends without a blank line.
- Cancel the underlying request when the subscription cancels or the bloc closes.

Web transport constraints:

- The Dio browser adapter does not stream a response body. Use the browser `fetch` streaming reader
  from `package:web` and read the response body reader.
- Do **not** use the browser `EventSource`. It cannot send a POST body and it cannot set an
  `Authorization` header. Both are required here.
- Implement cancellation with `AbortController`. Pass its signal to `fetch` and abort it when the
  subscription cancels. Without it the browser holds the connection open.
- Any proxy in front of the server must have response buffering off. A buffering proxy makes the
  stream arrive as one block at the end.

### 4b. Blocked on the API contract

- `models/` — one file per model, `@freezed` plus `@JsonSerializable`. `build.yaml` already points
  `generate_for` at `lib/api/models/**` with `field_rename: snake`.
- `resources/` — one class per REST resource group, grouped by server path, not by screen.
- `kanthord_api.dart` — holds one `Dio`, built from `ApiConfig` when the caller passes none, and
  exposes the resource groups so a call site reads as an SDK.
- The `AgentEvent` type the SSE client emits. Its variants come from the SSE event names.

### 4c. Blocked on the auth flow

`interceptors/auth_interceptor.dart`:

- Read the token through `TokenProviderType`. Attach it as a bearer token.
- On a 401, refresh once **per token**, not once per request. A second 401 with the same fresh
  token becomes the unauthorized exception.
- Hold the refresh in a single shared `Future`. Ten concurrent 401s await one refresh call, then all
  retry. Do not fire ten refresh calls.
- Send the refresh request on a `Dio` instance **without** the auth interceptor. A refresh that
  re-enters the interceptor recurses forever.
- On a failed refresh, clear the tokens and throw the unauthorized exception. The app layer decides
  what the user sees.

### Step 4 verification

`test/api/` must cover, at minimum:

- Each resource method against a `Dio` mock adapter. Assert the path, the body, and the decoded
  model.
- SSE parser: a multiline `data:`, a `\r\n` stream, a comment heartbeat, a multi-byte character
  split across two chunks, an unknown field, and a stream that ends without a trailing blank line.
- Auth interceptor: fire three concurrent 401s and assert the refresh endpoint receives exactly one
  call.
- Retry interceptor: assert a `POST` is never retried.

Also assert by inspection that `lib/api/` imports nothing from `lib/features/`, `lib/app/`, or
`lib/libraries/`.

## Step 5: the `agent_chat` feature

Blocked by step 4. Do not start it before the SDK tests pass.

Scope: one vertical slice that sends a prompt and streams the answer.

```
features/agent_chat/
├── agent_chat.dart              # barrel: routes only
├── agent_chat_routes.dart       # @TypedGoRoute
└── chat/
    ├── chat_bloc.dart           # takes KanthordApi in the constructor
    ├── chat_state.dart          # @freezed sealed class
    ├── chat_page.dart
    └── widgets/
```

- The bloc calls the SDK, maps the result to state, and maps an `ApiException` to an error state.
- The route creates the bloc and passes `getIt<KanthordApi>()`. Add no `Dependencies` file.
- The page renders `KD` components and contains no API call.
- Cancel the stream subscription when the bloc closes.

### Design system work this step needs

Build each one in the order from `DESIGNS.md`: document, implement, add to `KDGalleryPage`, verify in
four combinations.

| Component | Layer | Why |
|---|---|---|
| `KDInputField` | atom | The prompt box |
| `KDButton` | atom | Send |
| `KDPaneView` | layout | One pane on `mobile`, list-detail split on `wide` |
| `KDDialog` | layout | A destination that is a full screen on `mobile` becomes a dialog on `wide` |

`KDPaneView` and `KDDialog` are defined in the design system spec but were deferred, because
nothing consumed them and step 3 capped the build at three components.

### App layer work this step needs

`lib/app/` still has no dependency injection and no router.

- Register `KanthordApi` once in `get_it` as a lazy singleton.
- Register the `TokenProviderType` implementation, selected per platform.
- Replace `home: KDGalleryPage(...)` in `kanthord_app.dart` with the `go_router` configuration.
  Keep a route to the gallery for development if you want one, but it is not a product destination.
- Add `lib/app/env/` with the `envied` classes, plus `.env.staging` and `.env.production`. Put no
  server secret in either file. A web build ships readable JavaScript, so anything in the bundle is
  public.

### Step 5 verification

- The bloc test, with `KanthordApi` mocked. Do not mock a repository, because none exists.
- Run against the real server on macOS and on web. The server must send CORS headers for the client
  origin and must expose the SSE content type.

## Step 6: documentation

- `lib/api/README.md` — the resource table (resource, method, HTTP verb, path, model) plus the auth
  and retry rules. Write it with the SDK.
- Update `CLAUDE.md`: move each item out of "Current state" as it lands, and delete the bootstrap
  exceptions once the router and the first feature exist.
- Update `docs/operations.md` when the `build.yaml` paths start producing output, and when
  `.env.staging` and `.env.production` exist.
- Update `lib/libraries/kd_design_system/README.md` with every new component.
- A technical document per new molecule, organism, and template.

## Known gaps carried forward

- Every design token is seeded from the Material 3 baseline and marked `// TODO(tokens)`. The seed
  is `0xFF6750A4`. Nothing here is a brand value.
- `styles/kd_fonts.dart` and `styles/kd_shadow_styles.dart` are absent on purpose. No font asset
  exists, and Material 3 expresses depth with elevation. Create each when a real value arrives.
- `freezed` is pinned to `^3.2.5` and `mockito` to `^5.6.4`. Both stable. `freezed` stable needs
  `analyzer <11 or ^12`; `mockito >=5.7.0` needs `analyzer >=13`. They cannot both be newest.
  Revisit when `freezed` 4 reaches stable.
- The branch-name pattern in `check-pull-request.yml` is `type/ENGA-123-short-description`. The
  original specification fixed the commit format but not the branch format. Confirm it with the
  owner.
- `build-matrix.yml` has never run. The first push to `main` is the first real Windows and Linux
  compile.
