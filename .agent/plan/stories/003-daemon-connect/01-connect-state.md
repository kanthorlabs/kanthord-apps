# Story 01 — `ConnectState` and `ConnectTarget`

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
abstract class ConnectTarget with _$ConnectTarget {
  const factory ConnectTarget({
    required String daemonId,
    required String daemonName,
    required String baseUrl,
    required String token,
  }) = _ConnectTarget;
}

@freezed
sealed class ConnectState with _$ConnectState {
  const factory ConnectState.unselected() = ConnectUnselected;

  const factory ConnectState.idle({required ConnectTarget target}) = ConnectIdle;

  const factory ConnectState.probing({required ConnectTarget target}) = ConnectProbing;

  const factory ConnectState.connected({
    required ConnectTarget target,
    required Health health,
  }) = ConnectConnected;

  const factory ConnectState.tokenRejected({
    required ConnectTarget target,
    required String detail,
  }) = ConnectTokenRejected;

  const factory ConnectState.daemonRejected({
    required ConnectTarget target,
    required String code,
    required String host,
    required String configKey,
  }) = ConnectDaemonRejected;

  const factory ConnectState.unreachable({
    required ConnectTarget target,
    required String detail,
    required bool isOpaque,
  }) = ConnectUnreachable;

  const factory ConnectState.storageFailed({
    required ConnectTarget target,
    required String detail,
  }) = ConnectStorageFailed;
}

ConnectTarget? targetOf(ConnectState state) => switch (state) {
  ConnectUnselected() => null,
  ConnectIdle(:final target) => target,
  ConnectProbing(:final target) => target,
  ConnectConnected(:final target) => target,
  ConnectTokenRejected(:final target) => target,
  ConnectDaemonRejected(:final target) => target,
  ConnectUnreachable(:final target) => target,
  ConnectStorageFailed(:final target) => target,
};
```

### `test/**`

New file `test/features/daemon_connect/connect/connect_state_test.dart`, verbatim:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/models/health.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_state.dart';

const ConnectTarget _kTarget = ConnectTarget(
  daemonId: 'daemon-1',
  daemonName: 'local',
  baseUrl: 'http://localhost:31415',
  token: 'a-token',
);

const Map<String, dynamic> _kHealthBody = <String, dynamic>{
  'status': 'ok',
  'dependencies': <dynamic>[],
};

void main() {
  group('targetOf', () {
    group('the unselected state', () {
      test('should answer null when no daemon is selected', () {
        // Arrange
        const state = ConnectState.unselected();

        // Act
        final target = targetOf(state);

        // Assert
        expect(target, isNull);
      });
    });

    group('every daemon bearing state', () {
      test('should answer the target when the state carries one', () {
        // Arrange
        final states = <ConnectState>[
          const ConnectState.idle(target: _kTarget),
          const ConnectState.probing(target: _kTarget),
          ConnectState.connected(target: _kTarget, health: Health.fromJson(_kHealthBody)),
          const ConnectState.tokenRejected(target: _kTarget, detail: 'refused'),
          const ConnectState.daemonRejected(
            target: _kTarget,
            code: 'host-forbidden',
            host: 'localhost:31415',
            configKey: 'KANTHORD_HTTP_ALLOWED_HOSTS',
          ),
          const ConnectState.unreachable(
            target: _kTarget,
            detail: 'no answer',
            isOpaque: false,
          ),
          const ConnectState.storageFailed(target: _kTarget, detail: 'not saved'),
        ];

        // Act
        final targets = states.map(targetOf).toList();

        // Assert
        expect(targets, hasLength(7));
        expect(targets, everyElement(_kTarget));
      });
    });
  });

  group('ConnectTarget', () {
    group('copyWith', () {
      test('should keep the daemon identity when the base URL is replaced', () {
        // Arrange
        const target = _kTarget;

        // Act
        final replaced = target.copyWith(baseUrl: 'http://10.0.2.2:31415');

        // Assert
        expect(replaced.daemonId, 'daemon-1');
        expect(replaced.daemonName, 'local');
        expect(replaced.baseUrl, 'http://10.0.2.2:31415');
        expect(replaced.token, 'a-token');
      });
    });
  });
}
```

### Codegen

The software-engineer runs `make generate-lib` and commits
`lib/features/daemon_connect/connect/connect_state.freezed.dart`. Never `make generate`.
`build.yaml:12` runs `freezed` over `lib/features/**_state.dart`, and `connect_state.dart` matches
that glob. `ConnectTarget` therefore lives in this file and in no other, because a
`lib/features/daemon_connect/connect/connect_target.dart` would match no `freezed` glob and would
generate nothing.

## Constraints

- Eight variants, no more: `unselected`, `idle`, `probing`, `connected`, the three probe-failure
  variants of Story 02, and `storageFailed`.
- **`unselected` carries no field.** It means `selected()` answered `null`. It is a normal state and
  never an error. EPIC G9.
- **Every other variant carries exactly one `ConnectTarget`.** `daemonId`, `daemonName`, `baseUrl`
  and `token` travel together, so a rebuild never loses the typed values and never pairs one daemon's
  name with another daemon's URL.
- `targetOf` is the only reader of the union. `unselected` declares no field, so `freezed` generates
  no shared `target` getter, and `state.target` does not compile. Every call site uses
  `targetOf(state)`.
- `targetOf` lists all eight variants explicitly. Do not add a `_` default arm: an exhaustive switch
  over a `sealed` class is a compile error when a variant is added, and that error is the guard.
- `storageFailed` is **not** a probe outcome. It reports that the daemon answered `200` and the
  client then failed to persist the proven configuration. `probeFailure` never returns it, and
  Story 04 emits it from the commit path alone.
- No variant carries a rendered sentence. `detail` is the daemon's own `ApiException.message`, and
  `code`, `host` and `configKey` are structured values the page composes into text.
- No `ConnectState.error` catch-all variant.
- The file declares no `KD` symbol, hard-codes no design value and holds no comment.
  `scripts/arch-check.sh:88-89` bans a comment under `lib/features/`.

## Verify

- `make test-one T=test/features/daemon_connect/connect/connect_state_test.dart` exits 0, and it
  asserts `targetOf` answers `null` for `unselected` and the carried target for each of the other
  seven variants.
- `make analyze` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: none directly. `connect_bloc_test.dart` (Story 04) and `probe_outcome_test.dart`
  (Story 02) consume every variant.

## Tasks

### Task 001.1 — the state test

**Input:** `test/features/daemon_connect/connect/connect_state_test.dart`

**Action — RED:** write the file verbatim. Run no codegen.

**Action — GREEN:** Task 001.2 creates the seam.

### Task 001.2 — the state

**Input:** `lib/features/daemon_connect/connect/connect_state.dart`

**Action — GREEN:** write the file verbatim, then run `make generate-lib` and commit
`connect_state.freezed.dart`.

**Action — REFACTOR:** none.
