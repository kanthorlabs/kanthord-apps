# Story 05 — the cursor schema and the paging rule

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 03 (`kRoutes`, `MockRoute.queryKeys`), Story 04 (the bearer rule).

**Both Tasks are the test-engineer lane.**

The cursor is proved on two levels, and the split is deliberate. This Story and Story 06 assert the
schema and the selection rule against `parseCursor` and `applyCursor` with a pinned row list, plus
the `400` answers over HTTP. Story 07 asserts the same paging end to end over the `populated`
scenario, which is the only fixture with more than one row.

## Change

- New `test/mock_daemon/cursor.dart`:

  ```dart
  const int kCursorDefaultLimit = 100;
  const int kCursorMaxLimit = 500;

  final class CursorError implements Exception {
    const CursorError(this.message);

    final String message;
  }

  final class Cursor {
    const Cursor({required this.limit, this.after});

    final int limit;
    final String? after;
  }

  Cursor parseCursor(Map<String, String> query, Set<String> allowedKeys) {
    for (final key in query.keys) {
      if (!allowedKeys.contains(key)) {
        throw CursorError('the query key $key is not declared');
      }
    }
    final after = query['after'];
    if (after != null && after.isEmpty) {
      throw const CursorError('after must not be empty');
    }
    final raw = query['limit'];
    if (raw == null) {
      return Cursor(limit: kCursorDefaultLimit, after: after);
    }
    final coerced = coerceLimit(raw);
    if (coerced == null || coerced < 1 || coerced > kCursorMaxLimit) {
      throw CursorError('limit must be an integer between 1 and $kCursorMaxLimit');
    }
    return Cursor(limit: coerced, after: after);
  }

  int? coerceLimit(String raw) {
    final trimmed = raw.trim();
    final value = trimmed.isEmpty ? 0.0 : double.tryParse(trimmed);
    if (value == null || value.isNaN || value.isInfinite) {
      return null;
    }
    if (value != value.roundToDouble()) {
      return null;
    }
    return value.toInt();
  }

  List<Map<String, dynamic>> applyCursor(List<Map<String, dynamic>> rows, Cursor cursor) {
    final sorted = List<Map<String, dynamic>>.of(rows)
      ..sort((left, right) => (left['id']! as String).compareTo(right['id']! as String));
    final after = cursor.after;
    final selected = after == null
        ? sorted
        : sorted.where((row) => (row['id']! as String).compareTo(after) > 0).toList();
    return selected.take(cursor.limit).toList();
  }
  ```

- `test/mock_daemon/mock_daemon.dart` — add `import 'cursor.dart';`, and replace the fixture-serving
  tail of `_handle`:

  ```dart
      final fixture = loadFixture(match.route.operation);
      if (fixture == null) {
        await writeError(
          request.response,
          'not-implemented',
          'the operation ${match.route.operation} ships in a later phase',
        );
        return;
      }
      await writeJson(request.response, HttpStatus.ok, fixture);
  ```

  with:

  ```dart
      final Cursor cursor;
      try {
        cursor = parseCursor(request.uri.queryParameters, match.route.queryKeys);
      } on CursorError catch (error) {
        await writeError(request.response, 'invalid-request', error.message);
        return;
      }
      final fixture = loadFixture(match.route.operation);
      if (fixture == null) {
        await writeError(
          request.response,
          'not-implemented',
          'the operation ${match.route.operation} ships in a later phase',
        );
        return;
      }
      if (match.route.operation != 'event.list') {
        await writeJson(request.response, HttpStatus.ok, fixture);
        return;
      }
      final rows = (fixture['events']! as List<dynamic>).cast<Map<String, dynamic>>();
      await writeJson(request.response, HttpStatus.ok, <String, dynamic>{
        'events': applyCursor(rows, cursor),
      });
  ```

## Constraints

- `parseCursor` runs on **every** route, with that route's own `queryKeys`. Every route except
  `event.list` declares the empty set, so any query key on any other path is
  `400 invalid-request`. `docs/api/conventions.md:75-83` makes the object strict, and
  `docs/api/contract/features/event.yaml:12-53` declares query parameters for `event.list` alone.
- The three schema rules come from `src/http/contract/cursor.ts`, quoted at
  `docs/api/conventions.md:75-92`: `limit` coerces to an integer, defaults to `100`, and is bounded
  `1..500`; `after` is optional with `min(1)`, so `after=` is `400 invalid-request` and an absent
  `after` is not the same thing; the object is strict.
- **`limit` is coerced, not parsed as an integer.** The schema is `z.coerce.number().int()`, and
  `z.coerce.number()` runs JavaScript's `Number(value)` before `.int()` checks integrality. So
  `limit=1.0` and `limit=1e2` are **legal** and mean `1` and `100`, `limit=' 5 '` is `5` because
  `Number` trims, and `limit=` is `0` because `Number('')` is `0` — which then fails `min(1)` and is
  `400`. `int.tryParse` would reject `1.0` and `1e2`, which would make the mock **stricter than the
  daemon** and teach the client that a legal request fails. `coerceLimit` reproduces the coercion
  with `double.tryParse` plus an integrality check.
- `limit=1.5` is `400`, because `.int()` refuses a non-integer after coercion. `limit=abc` is `400`,
  because `Number('abc')` is `NaN`. `limit=0` and `limit=501` fail the bound.
- `coerceLimit` is not a full re-implementation of `Number()`. `double.tryParse` accepts a leading
  `+`, `Infinity` and `NaN` exactly as `Number` does, and the bound and the `isInfinite`/`isNaN`
  guards reject the last two the same way `.int()` does. The one known divergence is a hexadecimal
  literal: `Number('0x10')` is `16` and `double.tryParse('0x10')` is null, so the mock answers `400`
  where the daemon would answer a page of 16. No client sends a hexadecimal limit. State the
  divergence; do not widen the parser to close it.
- `applyCursor` sorts ascending by `id`, then filters `id > after`, then takes `limit`. That order is
  fixed. `docs/api/conventions.md:94-99` states the engine builds `WHERE id > ?` with
  `ORDER BY id ASC`, and the comparison is an ordinary string compare over the whole prefixed id.
- **The five domain filters are accepted and never applied.** `subject`, `subjectKind`, `type`,
  `actor` and `actorKind` pass the strict-key check and change no row. The mock pages a fixture
  list; it runs no query engine. So a test must never assert that a filter narrowed a result, and
  no client behavior in this EPIC may depend on server-side filtering. This is a stated limit of
  the mock, not fidelity to the daemon.
- The cursor applies to `event.list` and to no other operation. No other published example carries a
  `query` block, and no list response carries pagination metadata — a short page means the end,
  per `docs/api/conventions.md:114-123`.
- `parseCursor` runs **before** the fixture lookup, so a malformed query on a fixture-less routed
  operation answers `400`, not `501`. A schema failure precedes a phase failure.

## Tasks

### Task 005.1 — the cursor schema test

**Input:** `test/mock_daemon/cursor_test.dart`, `test/mock_daemon/cursor.dart`

**Action — RED:** create `test/mock_daemon/cursor_test.dart`. Import `dart:convert`, `dart:io`,
`package:flutter_test/flutter_test.dart`, `cursor.dart`, `mock_daemon.dart`, `routes.dart`.

Drive every request through `probe` from `http_probe.dart`. Mark every test body with `// Arrange`,
`// Act` and `// Assert`. Declare one pinned row list that every paging test shares:

```dart
const List<Map<String, dynamic>> _kRows = <Map<String, dynamic>>[
  <String, dynamic>{'id': 'event_01JQ8Z7G3H0000000000000001'},
  <String, dynamic>{'id': 'event_01JQ8Z7G3H0000000000000002'},
  <String, dynamic>{'id': 'event_01JQ8Z7G3H0000000000000003'},
  <String, dynamic>{'id': 'event_01JQ8Z7G3H0000000000000004'},
  <String, dynamic>{'id': 'event_01JQ8Z7G3H0000000000000005'},
];

List<String> _ids(List<Map<String, dynamic>> rows) =>
    rows.map((row) => row['id']! as String).toList();
```

Group `parseCursor`:

- `'should default the limit to one hundred when no limit is sent'` — assert
  `parseCursor(<String, String>{}, kEventQueryKeys).limit` equals `100`.
- `'should return the sent limit when the limit is inside the bound'` — `{'limit': '250'}`, assert
  `250`.
- `'should return the maximum when the limit is five hundred'` — `{'limit': '500'}`, assert `500`.
- `'should return null after when no after is sent'` — assert `.after` is null.
- `'should return the sent after when an after is sent'` — `{'after': 'event_01'}`, assert
  `.after` equals `'event_01'`.
- `'should coerce the limit when the value is written as a whole decimal'` — `{'limit': '1.0'}`,
  assert `.limit` equals `1`. `z.coerce.number().int()` accepts it, so the mock must too.
- `'should coerce the limit when the value is written in exponent form'` — `{'limit': '1e2'}`,
  assert `.limit` equals `100`.
- `'should coerce the limit when the value carries whitespace'` — `{'limit': ' 5 '}`, assert
  `.limit` equals `5`.
- `'should throw when the limit is zero'` — `{'limit': '0'}`, assert
  `throwsA(isA<CursorError>())`.
- `'should throw when the limit is above the maximum'` — `{'limit': '501'}`, assert the same.
- `'should throw when the limit is not a number'` — `{'limit': 'ten'}`, assert the same.
- `'should throw when the limit is a fractional decimal'` — `{'limit': '1.5'}`, assert the same.
  `.int()` refuses it after coercion.
- `'should throw when the limit is empty'` — `{'limit': ''}`, assert the same. `Number('')` is `0`,
  which fails the lower bound.
- `'should throw when after is empty'` — `{'after': ''}`, assert the same.
- `'should throw when a query key is not declared'` — `{'offset': '10'}`, assert the same.
- `'should throw when a declared key is used on a route that declares none'` — call
  `parseCursor(<String, String>{'limit': '10'}, const <String>{})`, assert the same. This is the
  rule that makes every non-event route reject every query key.

Group `applyCursor`:

- `'should return every row when no after is sent and the limit is large'` — `Cursor(limit: 100)`,
  assert `_ids(applyCursor(_kRows, cursor))` equals the five ids in ascending order.
- `'should return the first rows when the limit is smaller than the list'` —
  `Cursor(limit: 2)`, assert the first two ids.
- `'should sort ascending when the rows arrive out of order'` — pass
  `_kRows.reversed.toList()`, assert the five ids come back ascending.
- `'should exclude the after row when an after is sent'` —
  `Cursor(limit: 100, after: 'event_01JQ8Z7G3H0000000000000002')`, assert ids three, four and five.
  `after` is an exclusive lower bound.
- `'should apply the limit after the filter when both are sent'` —
  `Cursor(limit: 2, after: 'event_01JQ8Z7G3H0000000000000002')`, assert ids three and four.

Group `MockDaemon`, nested group `the cursor schema`:

- `'should answer invalid-request when the limit is zero'` — `GET`
  `'${daemon.baseUrl}/v1/event?limit=0'`, assert the status is `400` and the error `code` is
  `'invalid-request'`.
- `'should answer invalid-request when the limit is above the maximum'` — `?limit=501`, assert
  `400`.
- `'should answer invalid-request when the limit is not an integer'` — `?limit=ten`, assert `400`.
- `'should answer invalid-request when after is empty'` — `?after=`, assert `400`.
- `'should answer invalid-request when a query key is not declared'` — `?offset=10`, assert `400`.
- `'should answer invalid-request when a query key is sent to a route that declares none'` — `GET`
  `'/v1/health?limit=10'`, assert `400`.
- `'should answer invalid-request before not-implemented when a fixture-less route carries a bad query'`
  — `GET` `'/v1/project?limit=0'`, assert the status is `400`, not `501`.
- `'should answer the published fixture when no cursor is sent'` — `GET` `'/v1/event'`, assert the
  status is `200` and the `events` array has the one row of
  `docs/api/contract/examples/event.list.json`.
- `'should answer the coerced page when the limit is written in exponent form'` — `GET`
  `'/v1/event?limit=1e2'`, assert the status is `200`.
- `'should answer the declared filters when the event query is sent'` — `GET`
  `'/v1/event?limit=10&subjectKind=node&subject=task_01JQ8Z7G3HZZZZZZZZZZZZZZZZ&type=node.state.changed&actorKind=daemon&actor=kanthord'`,
  assert the status is `200`. Every key of that query is in `kEventQueryKeys`, and the mock filters
  on none of them — it proves the keys are accepted, and the row count is not asserted.

Every daemon test registers `addTearDown(daemon.stop)`.

**Action — GREEN:** the same role writes `cursor.dart` and applies the `_handle` replacement, then
re-runs the file.

## Verify

- `make test-one T=test/mock_daemon/cursor_test.dart` exits 0.
- `make test-one T=test/mock_daemon/contract_enforcement_test.dart` exits 0. No test in that file
  sends a query key, so the strict rule does not move it.
- `make verify` exits 0.
- Proof: none of its own. It is one half of `PASS 004-G3-CURSOR`, which Story 06 delivers.
