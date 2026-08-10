# EPIC 003 — `daemon_connect`

Status: **ready**.

The first product feature and the first slice a human can run. It takes the base URL and the token,
proves them against `GET /v1/health`, and renders the only real data the daemon serves today.

## Goal

- **G1** — `lib/features/daemon_connect/` follows the feature layout of `CLAUDE.md`: a barrel of
  routes, `daemon_connect_routes.dart` with `@TypedGoRoute`, and a `connect/` screen with a bloc, a
  `@freezed` sealed state, a page and its widgets.
- **G2** — `ConnectBloc` takes `KanthordApi`, `DaemonRegistryType` and `DaemonCredentialStoreType`. It
  calls the SDK directly. There is no repository and no use case. Amended 2026-08-10: EPIC 001.1 adds
  `KanthordApi.withCandidate`, so the bloc takes the registered client and still probes a candidate;
  EPIC 002 replaces the two scalar stores with the registry and the credential store.
- **G3** — The probe runs against a **candidate** configuration built by
  `api.withCandidate(baseUrl:, token:)`. The entered base URL and token are written to the registry
  and the credential store only after a `200`, and that write also sets the daemon's `confirmedAt`. A
  failed probe leaves the previous working configuration in place.
- **G4** — The probe renders four outcomes as four states: a `200` proves the URL, the `Host` allow
  list and the token together; a `401` names the token; a `403` names the daemon configuration and
  shows the host the client sent and the config key; a connection failure names the URL.
- **G5** — On web, and only for `ApiNoNetworkException`, the message names all four opaque causes and
  the two daemon configuration keys. A `200`, a `401` and a `403` keep their own outcome on web.
- **G6** — A base URL whose host is not loopback shows a warning: the token crosses the network in
  clear text and it never expires.
- **G7** — A connected state renders the `system.health` body: the roll-up plus every dependency, in
  the order the daemon returned them, with `not-implemented` rendered as neither `ok` nor a failure.
- **G8** — A settings destination replaces the selected daemon's values, and an unauthorized state
  shows that daemon's name and base URL and offers to re-enter the token. Only an explicit action
  clears the token.
- **G9** — Every screen in this epic acts on **the selected daemon**. When `selected()` is null the
  screen renders the unselected state and calls no daemon. Adding, switching and removing a daemon are
  EPIC 003.1.

## Non-goals

- No chat page, no prompt box, no message list, no `AgentEvent`, no `send` method, and no branch
  named `agent-chat`. `docs/api/blockers.md` R1.
- No second feature. The feature after this one is owner decision D1, and every candidate is gated on
  engine work.
- No daemon list, no switcher, no add and no remove. **EPIC 003.1** owns every one, it is mandatory,
  and multi-daemon is not delivered until it ships. This epic provisions and proves the **selected**
  daemon only.
- No read screen over the graph. `project.list`, `node.list`, `edge.list` and `event.list` answer
  `501`.
- No poller subscription. Nothing on this screen changes over time.
- No new `KD` component. `HANDOFF.md` records that every component this flow needs is built and
  verified.
- No reverse-proxy mode. Every native target calls the daemon directly, and this screen builds direct
  browser access too, where the human types the token. The proxy topology of
  `docs/api/connectivity.md` serves one case — an HTTPS-served web bundle — holds the token
  server-side, and needs its own transport posture.
- No automatic retry of the probe. The human presses the button.

## Verification gate

Gates: `make verify`

Proof:

```bash
make test-one T=test/features/daemon_connect/connect/connect_bloc_test.dart \
  && echo "PASS 003-G2-BLOC" \
  && make test-one T=test/features/daemon_connect/connect/connect_candidate_test.dart \
  && echo "PASS 003-G3-CANDIDATE" \
  && make test-one T=test/features/daemon_connect/connect/probe_outcome_test.dart \
  && echo "PASS 003-G4-OUTCOMES" \
  && make test-one T=test/features/daemon_connect/connect/probe_outcome_web_test.dart \
  && echo "PASS 003-G5-WEB-MESSAGE" \
  && make test-one T=test/features/daemon_connect/connect/cleartext_warning_test.dart \
  && echo "PASS 003-G6-CLEARTEXT" \
  && make test-one T=test/features/daemon_connect/connect/connect_page_test.dart \
  && echo "PASS 003-G7-HEALTH-RENDER" \
  && make test-one T=test/features/daemon_connect/settings \
  && echo "PASS 003-G8-SETTINGS" \
  && make arch-check \
  && echo "PASS 003-G1-MECHANICAL" \
  && echo "PASS EPIC-003"
```

`make arch-check` proves two greps here: the feature hard-codes no colour, text style or radius, and
it calls no `Navigator.push`. It does not prove the directory layout. The layout is a
reviewer-engineer judgement and it is named in the review, not in the gate.

Hermetic coverage required beyond the Proof:

- The bloc test drives a **real `KanthordApi` over a mocked transport** and mocks no repository,
  because none exists. Amended 2026-08-10: `KanthordApi` and `SystemResource` are `final class`, so
  neither can be mocked. The seam is `test/api/dio_mock_adapter.dart` under the `adapterFactory` of
  EPIC 001.1 G8.
- A `401` leaves the stored token in place. The test reads the credential store after the probe.
- A failed probe leaves the selected daemon's base URL and `confirmedAt` in place.
- The four outcomes are asserted on the state, never on a rendered string.
- A commit that fails halfway restores the daemon entry and the credential it replaced.

These are `NEEDS-HUMAN:` items. `make verify` is headless and proves none of them. **The first one
gates this epic. The rest are carried forward.**

- **`make dev` against a real daemon.** Chrome at `http://localhost:8080`, with the daemon holding
  `KANTHORD_HTTP_PORT=31415`, `KANTHORD_HTTP_TOKEN`,
  `KANTHORD_HTTP_ALLOWED_ORIGINS=http://localhost:8080` and
  `KANTHORD_HTTP_ALLOWED_HOSTS=127.0.0.1:31415,localhost:31415`. The two loopback spellings are two
  entries: the daemon matches the whole `Host` value, port included. Engine EPIC 010.5 is merged, so
  nothing here waits. Also assert that a wrong origin still answers `403 origin-forbidden`, or the
  allow list is an opening rather than a list.
- The light theme and the dark theme at `expanded` first, then `wide` and `mobile`. The browser gives
  all three by resizing the window, with no second device.
- Carried forward: a real daemon on macOS, and a real daemon from a physical device.

## Stories

- **The routes** — the connect route, the settings route and the unauthorized route, added to the
  router EPIC 002 built. The route creates the bloc and passes `getIt<KanthordApi>()`. There is no
  `Dependencies` file.
- **`ConnectState`** — a `@freezed` sealed class: idle, probing, connected with the health body, and
  one state per failure outcome. A state is not a message.
- **The candidate probe** — the bloc builds a `KanthordApi` over the entered values, probes with it,
  and commits to the stores on success alone. This is why `ApiConfig` reads a provider: the
  registered singleton is untouched until the candidate proves itself.
- **The probe outcome map** — one pure function from `ApiException` plus the `isWeb` flag to the
  outcome. Four outcomes, one truth table, no widget test.
- **The connect page** — `KDFullScreenLayout` with `KDStatusView`, two `KDInputField` widgets and a
  `KDButton`. The token field uses the obscured mode and the reveal control. The base URL field opens
  prefilled with `http://localhost:31415`, editable, and a stored value always wins over it. A test
  asserts that an empty store shows the convention and sends no request until the human confirms it.
- **The cleartext warning** — one pure function over the URL. The test covers `127.0.0.1`,
  `localhost`, `10.0.2.2` and a LAN address.
- **The health view** — the roll-up and the dependency list. An unknown status renders its raw string,
  through the open-enum representation EPIC 001 fixed.
- **The settings destination** — `KDDialog` above the shell on `wide` and above, full screen on
  `mobile`. It replaces both values and it is the only place that clears the token.
- **The unauthorized state** — shows the current base URL and offers the token field. Never a silent
  sign-out.
