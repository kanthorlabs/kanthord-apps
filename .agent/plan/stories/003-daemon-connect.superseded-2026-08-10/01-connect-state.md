# Story 01 — `ConnectState`

> **SUPERSEDED on 2026-08-10 — re-expand before implementing.** The product holds more than
> one daemon, and `KanthordApi.withCandidate` replaces `ProbeClientBuilder`. Read the STOP
> block in `index.md` for this file's delta specification. Everything below still shows the
> shape, the guards and the tests that survive.

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: EPIC 001 (`lib/api/api.dart`, `Health`).

## Change

### `lib/**`

New file `lib/features/daemon_connect/connect/connect_state.dart`, verbatim:

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../api/api.dart';

part 'connect_state.freezed.dart';

@freezed
sealed class ConnectState with _$ConnectState {
  const factory ConnectState.idle({required String baseUrl, required String token}) = ConnectIdle;

  const factory ConnectState.probing({required String baseUrl, required String token}) =
      ConnectProbing;

  const factory ConnectState.connected({
    required String baseUrl,
    required String token,
    required Health health,
  }) = ConnectConnected;

  const factory ConnectState.tokenRejected({
    required String baseUrl,
    required String token,
    required String detail,
  }) = ConnectTokenRejected;

  const factory ConnectState.daemonRejected({
    required String baseUrl,
    required String token,
    required String code,
    required String host,
    required String configKey,
  }) = ConnectDaemonRejected;

  const factory ConnectState.unreachable({
    required String baseUrl,
    required String token,
    required String detail,
    required bool isOpaque,
  }) = ConnectUnreachable;

  const factory ConnectState.storageFailed({
    required String baseUrl,
    required String token,
    required String detail,
  }) = ConnectStorageFailed;
}
```

### Codegen

The software-engineer runs `make generate-lib` and commits
`lib/features/daemon_connect/connect/connect_state.freezed.dart`. Never `make generate`.

## Constraints

- Seven variants, no more. `idle`, `probing`, `connected`, the three probe-failure variants of
  Story 02, and `storageFailed`.
- `storageFailed` is **not** a probe outcome. It reports that the daemon answered `200` and the
  client then failed to persist the proven pair. `probeFailure` never returns it, and Story 04 emits
  it from the commit path alone. It closes risk S1 in `index.md`.
- Every variant carries `baseUrl` and `token`, so a rebuild never loses the typed values.
- No variant carries a rendered sentence. `detail` is the daemon's own `ApiException.message`, and
  `code`, `host` and `configKey` are structured values the page composes into text.
- No `ConnectState.error` catch-all variant.
- The file declares no `KD` symbol, hard-codes no design value and holds no comment.
  `scripts/arch-check.sh:88-89` bans a comment under `lib/features/`.

## Verify

- `make analyze` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: none directly. `connect_bloc_test.dart` (Story 04) and `probe_outcome_test.dart`
  (Story 02) consume every variant.

## Tasks

### Task 001.1 — the state

**Input:** `lib/features/daemon_connect/connect/connect_state.dart`

**Action — GREEN:** write the file verbatim, then run `make generate-lib` and commit
`connect_state.freezed.dart`.

**Action — REFACTOR:** none.
