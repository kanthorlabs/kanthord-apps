# Story 09 — `SystemResource`

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 04 (`kApiIsWeb`), Story 08 (the four models).

## Change

- New `lib/api/resources/system_resource.dart`:

  ```dart
  import 'package:dio/dio.dart';

  import '../api_config.dart';
  import '../api_exception.dart';
  import '../api_platform.dart';
  import '../models/db_status.dart';
  import '../models/health.dart';

  final class SystemResource {
    const SystemResource(this._dio, this._config);

    final Dio _dio;
    final ApiConfig _config;

    Future<Health> health() => _get('/v1/health', 'system.health', Health.fromJson);

    Future<DbStatus> db() => _get('/v1/db/status', 'system.db', DbStatus.fromJson);

    Future<T> _get<T>(
      String path,
      String operation,
      T Function(Map<String, dynamic> json) decode,
    ) async {
      try {
        final response = await _dio.get<dynamic>(
          path,
          options: Options(receiveTimeout: _config.receiveTimeoutFor(operation)),
        );
        final data = response.data;
        if (data is! Map<String, dynamic>) {
          throw const ApiDecodeException('the daemon answered a body that is not an object');
        }
        return decode(data);
      } on DioException catch (error) {
        throw ApiException.fromDio(error, isWeb: kApiIsWeb);
      } on TypeError {
        throw const ApiDecodeException('the daemon answered a body the model does not accept');
      }
    }
  }
  ```

## Constraints

- Two methods only. `system.status` and `blob.show` answer `501` today, and EPIC 006 owns them.
- A method returns the model. Never a `Response`, never a `Map`, never a `Stream`, never `Either`,
  never `Result`. `scripts/arch-check.sh` fails a `Stream<` under `lib/api/resources/`.
- The resource never constructs `Dio`. It takes the one `KanthordApi` holds.
- The resource sets no base URL and no `Authorization` header. The two interceptors own both.
- The decode boundary is exactly two cases: a body that is not a JSON object, and a `TypeError` from
  the generated `fromJson`. `json_serializable` throws a `TypeError` on a missing or wrong-typed
  field, and `build.yaml` enables no `checked` mode, so no other decode exception is reachable from
  these two models. Do not widen the catch, and do not add a bare `catch`.
- A `BaseUrlProviderType` that throws is out of scope. EPIC 002 owns the implementation and its
  contract, and no test here covers it.

## Tasks

### Task 009.1 — the contract-backed resource test

**Input:** `test/api/resources/system_resource_test.dart`

**Action — RED:** build a `Dio()` whose `httpClientAdapter` is `MockHttpClientAdapter` from
`test/api/dio_mock_adapter.dart`, with `options.baseUrl = 'http://127.0.0.1:31415'`, and a
`SystemResource(dio, ApiConfig(baseUrlProvider: stubProvider))`.

Read the response bodies from the published contract, never from invented bytes:

```dart
final example =
    jsonDecode(File('docs/api/contract/examples/system.health.json').readAsStringSync())
        as Map<String, dynamic>;
final success = example['success'] as Map<String, dynamic>;
final failure = example['error'] as Map<String, dynamic>;
```

`example['error']` is already the complete envelope — the file nests `{"error": {"error": {...}}}` —
so `adapter.respond` returns `jsonResponse(failure, 503)` unchanged. Never unwrap it one more level:
the inner object alone decodes to `ApiDecodeException`, not `ApiResponseException`.

Assign `adapter.respond` in every test of this Story before the act step.

Group `SystemResource`, nested group `health`:

- `'should request the health path when health is called'` — assert
  `adapter.requests.single.path` equals `'/v1/health'` and the method is `'GET'`.
- `'should send the configured receive timeout when health is called'` — assert
  `adapter.requests.single.receiveTimeout` equals `ApiConfig.receiveTimeout`. The header assertion
  belongs to Story 10, because `KanthordApi` sets the header and this test would otherwise assert a
  header it installed itself.
- `'should decode the published example when the daemon answers 200'` — the adapter answers the
  `success` object of `docs/api/contract/examples/system.health.json`; assert `status.known` equals
  `HealthStatus.ok` and the single dependency is `'storage'` with `DependencyStatus.ok`.
- `'should throw a response error when the daemon answers 503'` — the adapter answers the `error`
  object of the same file at status `503`; assert `isA<ApiResponseException>()` with `code`
  `'service-unavailable'`.
- `'should throw a decode error when the body is not an object'` — the adapter answers `[1, 2]`;
  assert `isA<ApiDecodeException>()`.
- `'should throw a decode error when a required field is missing'` — the adapter answers
  `{'dependencies': []}`; assert `isA<ApiDecodeException>()`.

Nested group `db`, the same shape against
`docs/api/contract/examples/system.db.json`:

- `'should request the db status path when db is called'` — asserts `'/v1/db/status'` and the method
  `'GET'`.
- `'should send the configured receive timeout when db is called'` — asserts
  `ApiConfig.receiveTimeout`.
- `'should decode the published example when the daemon answers 200'` — asserts one migration with
  `version` 1, `name` `'core-entities'`, `applied` true and `appliedAt` `1738368000000`.
- `'should throw a response error when the daemon answers 503'` — the `error` envelope of
  `docs/api/contract/examples/system.db.json` at status `503`; assert `isA<ApiResponseException>()`
  with `code` `'service-unavailable'`.

**Action — GREEN:** the software-engineer's Task 009.2 creates the seam.

### Task 009.2 — the resource

**Input:** `lib/api/resources/system_resource.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/resources/system_resource_test.dart` exits 0.
- `make arch-check` exits 0 over the tree as it stands. `PASS 001-G8-BOUNDARY` belongs to Story 10,
  the last Story, because only the complete `lib/api/` tree proves the boundary.
- `make verify` exits 0.
- Proof: `PASS 001-G7-SYSTEM`.
