# Story 04 — the candidate probe and `ConnectBloc`

> **SUPERSEDED on 2026-08-10 — re-expand before implementing.** The product holds more than
> one daemon, and `KanthordApi.withCandidate` replaces `ProbeClientBuilder`. Read the STOP
> block in `index.md` for this file's delta specification. Everything below still shows the
> shape, the guards and the tests that survive.

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: Story 01 (`ConnectState`), Story 02 (`probeFailure`), EPIC 002
(`BaseUrlStoreType`, `Env`).

**Blocked on owner decision B1 and B2. Read `index.md`.** The EPIC requires the bloc to take
`KanthordApi` and requires the bloc test to mock it. `KanthordApi` and `SystemResource` are
`final class` (`.agent/plan/stories/001-transport-foundation/10-kanthord-api.md:19`,
`09-system-resource.md:19`), and a Dart `final` class cannot be implemented outside its own library,
so `@GenerateMocks([KanthordApi])` does not compile. This Story is written against the transport
seam instead — a real `KanthordApi` over a `Dio` carrying `MockHttpClientAdapter`, which is the seam
`KanthordApi`'s optional `Dio?` exists for (`docs/testing.md:49-55`).

## Change

### `lib/**` — the candidate client

New file `lib/features/daemon_connect/connect/candidate_client.dart`, verbatim:

```dart
import '../../../api/api.dart';

final class CandidateBaseUrlProvider implements BaseUrlProviderType {
  const CandidateBaseUrlProvider(this._baseUrl);

  final String _baseUrl;

  @override
  Future<String> baseUrl() async => _baseUrl;
}

final class CandidateTokenProvider implements TokenProviderType {
  CandidateTokenProvider(this._token);

  String? _token;

  @override
  Future<String?> token() async => _token;

  @override
  Future<void> save(String token) async => _token = token;

  @override
  Future<void> clear() async => _token = null;
}

typedef ProbeClientBuilder = KanthordApi Function({
  required String baseUrl,
  required String token,
});

KanthordApi buildProbeClient({required String baseUrl, required String token}) => KanthordApi(
  config: ApiConfig(baseUrlProvider: CandidateBaseUrlProvider(baseUrl)),
  tokens: CandidateTokenProvider(token),
);
```

### `lib/**` — the events

New file `lib/features/daemon_connect/connect/connect_event.dart`, verbatim:

```dart
sealed class ConnectEvent {
  const ConnectEvent();
}

final class ConnectStarted extends ConnectEvent {
  const ConnectStarted();
}

final class ConnectBaseUrlChanged extends ConnectEvent {
  const ConnectBaseUrlChanged(this.baseUrl);

  final String baseUrl;
}

final class ConnectTokenChanged extends ConnectEvent {
  const ConnectTokenChanged(this.token);

  final String token;
}

final class ConnectProbeRequested extends ConnectEvent {
  const ConnectProbeRequested();
}

final class ConnectTokenCleared extends ConnectEvent {
  const ConnectTokenCleared();
}
```

### `lib/**` — the bloc

New file `lib/features/daemon_connect/connect/connect_bloc.dart`, verbatim:

```dart
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../api/api.dart';
import '../../../app/env/env.dart';
import '../../../app/settings/base_url_store.dart';
import 'base_url_rule.dart';
import 'candidate_client.dart';
import 'connect_event.dart';
import 'connect_state.dart';
import 'probe_outcome.dart';

final class ConnectBloc extends Bloc<ConnectEvent, ConnectState> {
  ConnectBloc({
    required TokenProviderType tokens,
    required BaseUrlStoreType baseUrls,
    ProbeClientBuilder probeClientBuilder = buildProbeClient,
    bool isWeb = kApiIsWeb,
  }) : _tokens = tokens,
       _baseUrls = baseUrls,
       _probeClientBuilder = probeClientBuilder,
       _isWeb = isWeb,
       super(const ConnectState.idle(baseUrl: Env.apiEndpoint, token: '')) {
    on<ConnectStarted>(_onStarted);
    on<ConnectBaseUrlChanged>(_onBaseUrlChanged);
    on<ConnectTokenChanged>(_onTokenChanged);
    on<ConnectProbeRequested>(_onProbeRequested);
    on<ConnectTokenCleared>(_onTokenCleared);
  }

  final TokenProviderType _tokens;
  final BaseUrlStoreType _baseUrls;
  final ProbeClientBuilder _probeClientBuilder;
  final bool _isWeb;

  Future<void> _onStarted(ConnectStarted event, Emitter<ConnectState> emit) async {
    final stored = await _baseUrls.read();
    final token = await _tokens.token();
    emit(ConnectState.idle(baseUrl: stored ?? Env.apiEndpoint, token: token ?? ''));
  }

  void _onBaseUrlChanged(ConnectBaseUrlChanged event, Emitter<ConnectState> emit) {
    if (state is ConnectProbing) return;
    emit(ConnectState.idle(baseUrl: event.baseUrl, token: state.token));
  }

  void _onTokenChanged(ConnectTokenChanged event, Emitter<ConnectState> emit) {
    if (state is ConnectProbing) return;
    emit(ConnectState.idle(baseUrl: state.baseUrl, token: event.token));
  }

  Future<void> _onProbeRequested(ConnectProbeRequested event, Emitter<ConnectState> emit) async {
    if (state is ConnectProbing) return;
    final baseUrl = state.baseUrl;
    final token = state.token;
    if (!isUsableBaseUrl(baseUrl)) return;
    emit(ConnectState.probing(baseUrl: baseUrl, token: token));
    final api = _probeClientBuilder(baseUrl: baseUrl, token: token);
    try {
      final health = await api.system.health();
      final committed = await _commit(baseUrl, token);
      emit(
        committed
            ? ConnectState.connected(baseUrl: baseUrl, token: token, health: health)
            : ConnectState.storageFailed(
                baseUrl: baseUrl,
                token: token,
                detail: 'the client could not store the proven configuration',
              ),
      );
    } on ApiException catch (error) {
      emit(probeFailure(error, baseUrl: baseUrl, token: token, isWeb: _isWeb));
    } finally {
      api.dio.close(force: true);
    }
  }

  Future<bool> _commit(String baseUrl, String token) async {
    final previousBaseUrl = await _baseUrls.read();
    final previousToken = await _tokens.token();
    try {
      await _baseUrls.save(baseUrl);
      await _tokens.save(token);
      return true;
    } on Exception {
      await _restoreQuietly(previousBaseUrl, previousToken);
      return false;
    }
  }

  Future<void> _restoreQuietly(String? baseUrl, String? token) async {
    try {
      await (baseUrl == null ? _baseUrls.clear() : _baseUrls.save(baseUrl));
      await (token == null ? _tokens.clear() : _tokens.save(token));
    } on Exception {
      return;
    }
  }

  Future<void> _onTokenCleared(ConnectTokenCleared event, Emitter<ConnectState> emit) async {
    await _tokens.clear();
    emit(ConnectState.idle(baseUrl: state.baseUrl, token: ''));
  }
}
```

### `test/**` — the bloc test

New file `test/features/daemon_connect/connect/connect_bloc_test.dart`, verbatim:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:kanthord/features/daemon_connect/connect/candidate_client.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_bloc.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_event.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../api/dio_mock_adapter.dart';

const String _kBaseUrl = 'http://127.0.0.1:31415';
const String _kToken = 'a-token';

const Map<String, dynamic> _kHealthBody = <String, dynamic>{
  'status': 'ok',
  'dependencies': <dynamic>[
    <String, dynamic>{'name': 'storage', 'status': 'ok'},
  ],
};

Map<String, dynamic> _errorBody(String code, String message) => <String, dynamic>{
  'error': <String, dynamic>{'code': code, 'message': message},
};

final class _FailingTokenProvider implements TokenProviderType {
  _FailingTokenProvider(this._delegate);

  final TokenProviderType _delegate;

  @override
  Future<String?> token() => _delegate.token();

  @override
  Future<void> save(String token) async => throw Exception('the keychain refused the write');

  @override
  Future<void> clear() => _delegate.clear();
}

void main() {
  late MockHttpClientAdapter adapter;
  late BaseUrlStoreType baseUrls;
  late TokenProviderType tokens;
  late int builds;

  KanthordApi buildProbe({required String baseUrl, required String token}) {
    builds++;
    final dio = Dio()..httpClientAdapter = adapter;
    return KanthordApi(
      config: ApiConfig(baseUrlProvider: CandidateBaseUrlProvider(baseUrl)),
      tokens: CandidateTokenProvider(token),
      dio: dio,
    );
  }

  ConnectBloc buildBloc() =>
      ConnectBloc(tokens: tokens, baseUrls: baseUrls, probeClientBuilder: buildProbe, isWeb: false);

  setUp(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues(<String, Object>{});
    baseUrls = PreferencesBaseUrlProvider(await SharedPreferences.getInstance());
    tokens = CandidateTokenProvider(null);
    adapter = MockHttpClientAdapter();
    builds = 0;
  });

  group('ConnectBloc', () {
    group('ConnectStarted', () {
      test('should open on the convention when the store holds no base URL', () async {
        // Arrange
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectStarted());
        final state = await bloc.stream.first;

        // Assert
        expect(state, isA<ConnectIdle>());
        expect(state.baseUrl, 'http://localhost:31415');
        expect(state.token, '');
        expect(adapter.requests, isEmpty);
      });

      test('should open on the stored values when the store holds them', () async {
        // Arrange
        await baseUrls.save('http://10.0.2.2:31415');
        await tokens.save('stored-token');
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectStarted());
        final state = await bloc.stream.first;

        // Assert
        expect(state.baseUrl, 'http://10.0.2.2:31415');
        expect(state.token, 'stored-token');
      });
    });

    group('ConnectProbeRequested', () {
      test('should reach the connected state when the daemon answers the health body', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = buildBloc();
        addTearDown(bloc.close);
        bloc.add(const ConnectBaseUrlChanged(_kBaseUrl));
        bloc.add(const ConnectTokenChanged(_kToken));

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(4).toList();

        // Assert
        expect(states[2], isA<ConnectProbing>());
        expect(states[3], isA<ConnectConnected>());
        expect((states[3] as ConnectConnected).health.dependencies.single.name, 'storage');
      });

      test('should reach the token outcome when the daemon answers 401', () async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('unauthenticated', 'the token is wrong'), 401);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectTokenRejected>());
      });

      test('should reach the daemon outcome when the daemon answers 403 host-forbidden', () async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('host-forbidden', 'the host is not allowed'), 403);
        final bloc = buildBloc();
        addTearDown(bloc.close);
        bloc.add(const ConnectBaseUrlChanged(_kBaseUrl));

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(3).toList();

        // Assert
        expect(states[2], isA<ConnectDaemonRejected>());
        expect((states[2] as ConnectDaemonRejected).host, '127.0.0.1:31415');
        expect((states[2] as ConnectDaemonRejected).configKey, 'KANTHORD_HTTP_ALLOWED_HOSTS');
      });

      test('should reach the daemon outcome when the daemon answers 403 origin-forbidden', () async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('origin-forbidden', 'the origin is not allowed'), 403);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectDaemonRejected>());
        expect((states[1] as ConnectDaemonRejected).configKey, 'KANTHORD_HTTP_ALLOWED_ORIGINS');
      });

      test('should reach the URL outcome when the connection fails', () async {
        // Arrange
        adapter.respond = (options) =>
            throw DioException(requestOptions: options, type: DioExceptionType.connectionError);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectUnreachable>());
        expect((states[1] as ConnectUnreachable).isOpaque, isFalse);
      });

      test('should probe one time when the button is pressed twice in a row', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectProbeRequested());
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();
        await Future<void>.delayed(Duration.zero);

        // Assert
        expect(states[1], isA<ConnectConnected>());
        expect(builds, 1);
        expect(adapter.requests, hasLength(1));
      });

      test('should send no request when the base URL is not usable', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectBaseUrlChanged('not a url'));
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(1).toList();
        await Future<void>.delayed(Duration.zero);

        // Assert
        expect(states.single, isA<ConnectIdle>());
        expect(builds, 0);
        expect(adapter.requests, isEmpty);
      });

      test('should report a storage failure and restore the previous values when the token '
          'write fails', () async {
        // Arrange
        await baseUrls.save('http://localhost:31415');
        await tokens.save('the-working-token');
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final failing = _FailingTokenProvider(tokens);
        final bloc = ConnectBloc(
          tokens: failing,
          baseUrls: baseUrls,
          probeClientBuilder: buildProbe,
          isWeb: false,
        );
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectBaseUrlChanged(_kBaseUrl));
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(3).toList();

        // Assert
        expect(states[2], isA<ConnectStorageFailed>());
        expect(await baseUrls.read(), 'http://localhost:31415');
        expect(await tokens.token(), 'the-working-token');
      });
    });

    group('ConnectTokenCleared', () {
      test('should empty the token when the human clears it explicitly', () async {
        // Arrange
        await tokens.save('stored-token');
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectTokenCleared());
        final state = await bloc.stream.first;

        // Assert
        expect(state.token, '');
        expect(await tokens.token(), isNull);
      });
    });
  });
}
```

### `test/**` — the candidate test

New file `test/features/daemon_connect/connect/connect_candidate_test.dart`, verbatim:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:kanthord/features/daemon_connect/connect/candidate_client.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_bloc.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_event.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../api/dio_mock_adapter.dart';

const String _kBaseUrl = 'http://127.0.0.1:31415';
const String _kToken = 'a-token';
const String _kStoredBaseUrl = 'http://localhost:31415';
const String _kStoredToken = 'the-working-token';

const Map<String, dynamic> _kHealthBody = <String, dynamic>{
  'status': 'ok',
  'dependencies': <dynamic>[],
};

const Map<String, dynamic> _kUnauthenticatedBody = <String, dynamic>{
  'error': <String, dynamic>{'code': 'unauthenticated', 'message': 'the token is wrong'},
};

void main() {
  late MockHttpClientAdapter adapter;
  late BaseUrlStoreType baseUrls;
  late TokenProviderType tokens;

  KanthordApi buildProbe({required String baseUrl, required String token}) {
    final dio = Dio()..httpClientAdapter = adapter;
    return KanthordApi(
      config: ApiConfig(baseUrlProvider: CandidateBaseUrlProvider(baseUrl)),
      tokens: CandidateTokenProvider(token),
      dio: dio,
    );
  }

  ConnectBloc buildBloc() =>
      ConnectBloc(tokens: tokens, baseUrls: baseUrls, probeClientBuilder: buildProbe, isWeb: false);

  Future<ConnectState> probe(ConnectBloc bloc) async {
    bloc.add(const ConnectBaseUrlChanged(_kBaseUrl));
    bloc.add(const ConnectTokenChanged(_kToken));
    bloc.add(const ConnectProbeRequested());
    final states = await bloc.stream.take(4).toList();
    return states[3];
  }

  setUp(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues(<String, Object>{});
    baseUrls = PreferencesBaseUrlProvider(await SharedPreferences.getInstance());
    tokens = CandidateTokenProvider(null);
    adapter = MockHttpClientAdapter();
  });

  group('the candidate probe', () {
    group('the request', () {
      test('should send the entered base URL and the entered token when the probe runs', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        await probe(bloc);

        // Assert
        expect(adapter.requests, hasLength(1));
        expect(adapter.requests.single.uri.toString(), '$_kBaseUrl/v1/health');
        expect(adapter.requests.single.headers['Authorization'], 'Bearer $_kToken');
      });
    });

    group('a proven candidate', () {
      test('should commit both values when the daemon answers 200', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        final state = await probe(bloc);

        // Assert
        expect(state, isA<ConnectConnected>());
        expect(await baseUrls.read(), _kBaseUrl);
        expect(await tokens.token(), _kToken);
      });
    });

    group('a rejected candidate', () {
      test('should leave the stored token in place when the daemon answers 401', () async {
        // Arrange
        await baseUrls.save(_kStoredBaseUrl);
        await tokens.save(_kStoredToken);
        adapter.respond = (options) => jsonResponse(_kUnauthenticatedBody, 401);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        final state = await probe(bloc);

        // Assert
        expect(state, isA<ConnectTokenRejected>());
        expect(await tokens.token(), _kStoredToken);
      });

      test('should leave the stored base URL in place when the daemon answers 401', () async {
        // Arrange
        await baseUrls.save(_kStoredBaseUrl);
        await tokens.save(_kStoredToken);
        adapter.respond = (options) => jsonResponse(_kUnauthenticatedBody, 401);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        await probe(bloc);

        // Assert
        expect(await baseUrls.read(), _kStoredBaseUrl);
      });

      test('should leave both stored values in place when the connection fails', () async {
        // Arrange
        await baseUrls.save(_kStoredBaseUrl);
        await tokens.save(_kStoredToken);
        adapter.respond = (options) =>
            throw DioException(requestOptions: options, type: DioExceptionType.connectionError);
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        final state = await probe(bloc);

        // Assert
        expect(state, isA<ConnectUnreachable>());
        expect(await baseUrls.read(), _kStoredBaseUrl);
        expect(await tokens.token(), _kStoredToken);
      });
    });
  });
}
```

## Constraints

- The bloc mocks no repository. None exists. `docs/testing.md:41-45`.
- No `@GenerateMocks` and no `.mocks.dart` in this Story. Neither test file runs `make generate-test`.
- The registered `getIt<KanthordApi>()` singleton is never used for a probe. The bloc builds a
  candidate client per press through `ProbeClientBuilder`.
- **Single flight.** `_onProbeRequested` returns immediately while `state is ConnectProbing`, so two
  presses build one client and send one request. `_onBaseUrlChanged` and `_onTokenChanged` return
  the same way, so an in-flight probe always commits the values it was started with.
- The commit order is fixed: `_baseUrls.save` then `_tokens.save`, and both run only after
  `health()` returns.
- **The commit is restorable.** `_commit` reads both previous values first, and a write that raises
  restores both and answers `false`. The bloc then emits `ConnectStorageFailed`, never `connected`.
  `_restoreQuietly` swallows a second failure, because there is nothing left to try. This closes
  risk S1.
- **An unusable base URL never reaches `Dio`.** `_onProbeRequested` returns before it builds a
  client. This closes risk S2, and the page of Story 08 also disables the button.
- A failure path writes nothing to either store. `docs/api/auth.md:52` — "Do not clear the stored
  token on a 401."
- The bloc catches `ApiException` from the probe and `Exception` from the two stores. It does not
  catch `Object` and it does not catch `StateError`.
- `api.dio.close(force: true)` runs in `finally`, so a probe client leaks no connection.
- No automatic retry. `ConnectProbeRequested` is the only path that calls `health()`.
- The bloc holds no comment and hard-codes no design value.

## Verify

- `make test-one T=test/features/daemon_connect/connect/connect_bloc_test.dart` exits 0.
- `make test-one T=test/features/daemon_connect/connect/connect_candidate_test.dart` exits 0.
- `make verify` exits 0.
- Proof: `PASS 003-G2-BLOC` and `PASS 003-G3-CANDIDATE`.

## Tasks

### Task 004.1 — the bloc test and the candidate test

**Input:** `test/features/daemon_connect/connect/connect_bloc_test.dart`,
`test/features/daemon_connect/connect/connect_candidate_test.dart`

**Action — RED:** write both files verbatim. Run no codegen.

**Action — GREEN:** Task 004.2 creates the seam.

### Task 004.2 — the candidate client, the events and the bloc

**Input:** `lib/features/daemon_connect/connect/candidate_client.dart`,
`lib/features/daemon_connect/connect/connect_event.dart`,
`lib/features/daemon_connect/connect/connect_bloc.dart`

**Action — GREEN:** write the three files verbatim.

**Action — REFACTOR:** none.
