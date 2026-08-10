# Story 01 — `DaemonEndpoint`

Epic: `.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md`
Depends on: EPIC 001 (`lib/api/` exists).

## Change

- New `lib/api/daemon_endpoint.dart`:

  ```dart
  const String kDaemonIdKey = 'kanthord.daemonId';
  const String kCandidateDaemonId = 'kanthord.candidate';

  final class DaemonEndpoint {
    const DaemonEndpoint({required this.id, required this.name, required this.baseUrl});

    final String id;
    final String name;
    final String baseUrl;

    @override
    bool operator ==(Object other) =>
        other is DaemonEndpoint &&
        other.id == id &&
        other.name == name &&
        other.baseUrl == baseUrl;

    @override
    int get hashCode => Object.hash(id, name, baseUrl);
  }
  ```

- `lib/api/api.dart:4` — insert `export 'daemon_endpoint.dart';` after
  `export 'base_url_provider.dart';`, so the barrel stays alphabetical.

## Constraints

- No `@freezed`. `build.yaml:8-19` runs `freezed` over `lib/api/models/**` only, so a `@freezed`
  declaration outside that path generates nothing.
- No JSON. No `fromJson`, no `toJson`, no `@JsonSerializable`. Persistence is EPIC 002.
- `id` is opaque. No parsing, no validation, no format assumption.
- No comment in the file. `scripts/arch-check.sh:82` fails a `//` or `///` under `lib/api/`.
- Both constants live in this file, because both interceptors import them and neither imports the
  other.

## Tasks

### Task 001.1 — the value type

**Input:** `test/api/daemon_endpoint_test.dart`

**Action — RED:** write the file with `import 'package:flutter_test/flutter_test.dart';` and
`import 'package:kanthord/api/daemon_endpoint.dart';`. Group `DaemonEndpoint`:

- Nested group `constructor`:
  - `'should hold the three fields when it is constructed'` — construct
    `DaemonEndpoint(id: 'a', name: 'local', baseUrl: 'http://127.0.0.1:31415')`; assert `id` is
    `'a'`, `name` is `'local'`, `baseUrl` is `'http://127.0.0.1:31415'`.
- Nested group `equality`:
  - `'should be equal when the three fields match'` — two instances with the same three values;
    assert `first == second` and `first.hashCode == second.hashCode`.
  - `'should not be equal when the id differs'` — same `name` and `baseUrl`, different `id`; assert
    `first != second`.
  - `'should not be equal when the name differs'` — same `id` and `baseUrl`, different `name`;
    assert `first != second`.
  - `'should not be equal when the base URL differs'` — same `id` and `name`, different `baseUrl`;
    assert `first != second`.
- Nested group `constants`:
  - `'should name the daemon id extra key when the SDK pins a request'` — assert `kDaemonIdKey`
    equals `'kanthord.daemonId'`.
  - `'should name the candidate daemon id when a candidate is built'` — assert `kCandidateDaemonId`
    equals `'kanthord.candidate'`.

**Action — GREEN:** the software-engineer's Task 001.2 creates the seam.

### Task 001.2 — the file and the barrel

**Input:** `lib/api/daemon_endpoint.dart`, `lib/api/api.dart`

**Action — GREEN:** write `lib/api/daemon_endpoint.dart` exactly as the `## Change` section states,
and add the one barrel export line.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/daemon_endpoint_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001.1-G1-ENDPOINT`.
