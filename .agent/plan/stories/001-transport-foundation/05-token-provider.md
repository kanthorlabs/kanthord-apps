# Story 05 — `TokenProviderType`

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 02 (`lib/api/` exists).

## Change

- New `lib/api/token_provider.dart`, the interface alone, verbatim from `docs/api/auth.md`:

  ```dart
  abstract class TokenProviderType {
    Future<String?> token();
    Future<void> save(String token);
    Future<void> clear();
  }
  ```

## Constraints

- No `refreshToken()`. `docs/api/auth.md` deletes it — there is no refresh endpoint.
- No implementation here. EPIC 002 owns the secure-storage and in-memory implementations.
- The SDK reads no storage and imports no `flutter_secure_storage`.

## Tasks

### Task 005.1 — the interface test

**Input:** `test/api/token_provider_test.dart`

**Action — RED:** declare a `_RecordingTokenProvider implements TokenProviderType` inside the test
file, backed by one nullable `String` field. Group `TokenProviderType`, nested group `token`, with
these tests:

- `'should return null when no token is saved'`.
- `'should return the saved token when save was called'` — `await provider.save('secret')`, assert
  `await provider.token()` equals `'secret'`.
- `'should return null when clear was called'` — save, then `await provider.clear()`, assert
  `await provider.token()` is null.

The test proves the three-method signature compiles and round-trips. It asserts no production
behavior, because this Story ships an interface.

**Action — GREEN:** the software-engineer's Task 005.2 creates the seam.

### Task 005.2 — the interface

**Input:** `lib/api/token_provider.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/token_provider_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001-G4-TOKEN`.
