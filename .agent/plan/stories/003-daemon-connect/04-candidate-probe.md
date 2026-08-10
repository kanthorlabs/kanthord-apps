# Story 04 — the candidate probe and `ConnectBloc`

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: Story 01 (`ConnectState`, `ConnectTarget`, `targetOf`), Story 02 (`probeFailure`),
Story 03 (`isUsableBaseUrl`), EPIC 001.1 (`KanthordApi.withCandidate`, `adapterFactory`,
`StaticBaseUrlProvider`, `StaticTokenProvider`, `DaemonEndpoint`), EPIC 002 (`Daemon`,
`DaemonRegistryType`, `DaemonCredentialStoreType`).

Read the **assumed EPIC 002 contract** in `index.md` before you start. This Story cites four members
of it and nothing else: `registry.selected()`, `registry.update(daemon)`, `credentials.read(id)` and
`credentials.save(id, token)`, plus `credentials.delete(id)` for the explicit clear.

## Change

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

final class ConnectDaemonEdited extends ConnectEvent {
  const ConnectDaemonEdited({required this.name, required this.baseUrl});

  final String name;
  final String baseUrl;
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
import '../../../app/settings/daemon.dart';
import '../../../app/settings/daemon_registry.dart';
import '../../../app/token/daemon_credential_store.dart';
import 'base_url_rule.dart';
import 'connect_event.dart';
import 'connect_state.dart';
import 'probe_outcome.dart';

DateTime _systemNow() => DateTime.now();

final class ConnectBloc extends Bloc<ConnectEvent, ConnectState> {
  ConnectBloc({
    required KanthordApi api,
    required DaemonRegistryType registry,
    required DaemonCredentialStoreType credentials,
    bool isWeb = kApiIsWeb,
    DateTime Function() now = _systemNow,
  }) : _api = api,
       _registry = registry,
       _credentials = credentials,
       _isWeb = isWeb,
       _now = now,
       super(const ConnectState.unselected()) {
    on<ConnectStarted>(_onStarted);
    on<ConnectBaseUrlChanged>(_onBaseUrlChanged);
    on<ConnectTokenChanged>(_onTokenChanged);
    on<ConnectDaemonEdited>(_onDaemonEdited);
    on<ConnectProbeRequested>(_onProbeRequested);
    on<ConnectTokenCleared>(_onTokenCleared);
  }

  final KanthordApi _api;
  final DaemonRegistryType _registry;
  final DaemonCredentialStoreType _credentials;
  final bool _isWeb;
  final DateTime Function() _now;

  Future<void> _onStarted(ConnectStarted event, Emitter<ConnectState> emit) async {
    final daemon = await _registry.selected();
    if (daemon == null) {
      emit(const ConnectState.unselected());
      return;
    }
    final token = await _credentials.read(daemon.id);
    emit(
      ConnectState.idle(
        target: ConnectTarget(
          daemonId: daemon.id,
          daemonName: daemon.name,
          baseUrl: daemon.baseUrl,
          token: token ?? '',
        ),
      ),
    );
  }

  void _onBaseUrlChanged(ConnectBaseUrlChanged event, Emitter<ConnectState> emit) {
    if (state is ConnectProbing) return;
    final target = targetOf(state);
    if (target == null) return;
    emit(ConnectState.idle(target: target.copyWith(baseUrl: event.baseUrl)));
  }

  void _onTokenChanged(ConnectTokenChanged event, Emitter<ConnectState> emit) {
    if (state is ConnectProbing) return;
    final target = targetOf(state);
    if (target == null) return;
    emit(ConnectState.idle(target: target.copyWith(token: event.token)));
  }

  void _onDaemonEdited(ConnectDaemonEdited event, Emitter<ConnectState> emit) {
    if (state is ConnectProbing) return;
    final target = targetOf(state);
    if (target == null) return;
    emit(
      ConnectState.idle(
        target: target.copyWith(daemonName: event.name, baseUrl: event.baseUrl),
      ),
    );
  }

  Future<void> _onProbeRequested(ConnectProbeRequested event, Emitter<ConnectState> emit) async {
    if (state is ConnectProbing) return;
    final target = targetOf(state);
    if (target == null) return;
    if (!isUsableBaseUrl(target.baseUrl)) return;
    emit(ConnectState.probing(target: target));
    final candidate = _api.withCandidate(baseUrl: target.baseUrl, token: target.token);
    try {
      final health = await candidate.system.health();
      final committed = await _commit(target);
      emit(
        committed
            ? ConnectState.connected(target: target, health: health)
            : ConnectState.storageFailed(
                target: target,
                detail: 'the client could not store the proven configuration',
              ),
      );
    } on ApiException catch (error) {
      emit(probeFailure(error, target: target, isWeb: _isWeb));
    } finally {
      candidate.dio.close(force: true);
    }
  }

  Future<bool> _commit(ConnectTarget target) async {
    final previousDaemon = await _registry.selected();
    if (previousDaemon == null) return false;
    final previousToken = await _credentials.read(target.daemonId);
    try {
      await _registry.update(
        previousDaemon.copyWith(
          name: target.daemonName,
          baseUrl: target.baseUrl,
          confirmedAt: _now(),
        ),
      );
      await _credentials.save(target.daemonId, target.token);
      return true;
    } on Exception {
      await _restoreQuietly(previousDaemon, previousToken);
      return false;
    }
  }

  Future<void> _restoreQuietly(Daemon daemon, String? token) async {
    try {
      await _registry.update(daemon);
      await (token == null
          ? _credentials.delete(daemon.id)
          : _credentials.save(daemon.id, token));
    } on Exception {
      return;
    }
  }

  Future<void> _onTokenCleared(ConnectTokenCleared event, Emitter<ConnectState> emit) async {
    final target = targetOf(state);
    if (target == null) return;
    await _credentials.delete(target.daemonId);
    emit(ConnectState.idle(target: target.copyWith(token: '')));
  }
}
```

### `test/**` — the shared fakes

New file `test/features/daemon_connect/daemon_fakes.dart`, verbatim. It is a helper, not a test, and
it is the one place the EPIC 002 store contract is faked. Stories 04 and 08 both import it.

```dart
import 'package:kanthord/api/api.dart';
import 'package:kanthord/app/settings/daemon.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/token/daemon_credential_store.dart';

import '../../api/dio_mock_adapter.dart';

export 'package:kanthord/app/settings/daemon.dart' show Daemon;

const String kFakeDaemonId = 'daemon-1';
const String kFakeDaemonName = 'local';
const String kFakeBaseUrl = 'http://localhost:31415';

Daemon fakeDaemon({
  String id = kFakeDaemonId,
  String name = kFakeDaemonName,
  String baseUrl = kFakeBaseUrl,
  DateTime? confirmedAt,
}) => Daemon(id: id, name: name, baseUrl: baseUrl, confirmedAt: confirmedAt);

final class FakeDaemonRegistry implements DaemonRegistryType {
  FakeDaemonRegistry({List<Daemon>? daemons, String? selected})
    : _daemons = <Daemon>[...?daemons],
      _selectedId = selected;

  final List<Daemon> _daemons;
  String? _selectedId;

  int updates = 0;
  bool failUpdate = false;

  @override
  Future<List<Daemon>> list() async => List<Daemon>.unmodifiable(_daemons);

  @override
  Future<Daemon> add({required String name, required String baseUrl}) async {
    final daemon = Daemon(id: 'daemon-${_daemons.length + 1}', name: name, baseUrl: baseUrl);
    _daemons.add(daemon);
    return daemon;
  }

  @override
  Future<void> update(Daemon daemon) async {
    updates++;
    if (failUpdate) {
      throw Exception('the registry refused the write');
    }
    final index = _daemons.indexWhere((entry) => entry.id == daemon.id);
    if (index < 0) {
      throw StateError('no daemon holds the id ${daemon.id}');
    }
    _daemons[index] = daemon;
  }

  @override
  Future<void> remove(String id) async {
    _daemons.removeWhere((entry) => entry.id == id);
    if (_selectedId == id) {
      _selectedId = null;
    }
  }

  @override
  Future<void> select(String id) async => _selectedId = id;

  @override
  Future<String?> selectedId() async => _selectedId;

  @override
  Future<Daemon?> selected() async {
    final id = _selectedId;
    if (id == null) {
      return null;
    }
    for (final entry in _daemons) {
      if (entry.id == id) {
        return entry;
      }
    }
    return null;
  }

  @override
  Future<void> seedDefault() async {
    if (_daemons.isNotEmpty) {
      return;
    }
    final daemon = await add(name: kFakeDaemonName, baseUrl: kFakeBaseUrl);
    _selectedId = daemon.id;
  }
}

final class FakeDaemonCredentialStore implements DaemonCredentialStoreType {
  final Map<String, String> tokens = <String, String>{};

  bool failSave = false;

  @override
  Future<String?> read(String daemonId) async => tokens[daemonId];

  @override
  Future<void> save(String daemonId, String token) async {
    if (failSave) {
      throw Exception('the keychain refused the write');
    }
    tokens[daemonId] = token;
  }

  @override
  Future<void> delete(String daemonId) async => tokens.remove(daemonId);
}

KanthordApi fakeApi(MockHttpClientAdapter adapter) => KanthordApi(
  config: const ApiConfig(
    baseUrlProvider: StaticBaseUrlProvider(
      DaemonEndpoint(id: 'parent', name: 'parent', baseUrl: 'http://localhost:1'),
    ),
  ),
  tokens: const StaticTokenProvider('parent-token'),
  adapterFactory: () => adapter,
);
```

### `test/**` — the bloc test

New file `test/features/daemon_connect/connect/connect_bloc_test.dart`, verbatim:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_bloc.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_event.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_state.dart';

import '../../../api/dio_mock_adapter.dart';
import '../daemon_fakes.dart';

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

void main() {
  late MockHttpClientAdapter adapter;
  late FakeDaemonRegistry registry;
  late FakeDaemonCredentialStore credentials;

  ConnectBloc buildBloc() => ConnectBloc(
    api: fakeApi(adapter),
    registry: registry,
    credentials: credentials,
    isWeb: false,
    now: () => DateTime.utc(2026, 8, 10),
  );

  Future<ConnectBloc> started() async {
    final bloc = buildBloc();
    addTearDown(bloc.close);
    bloc.add(const ConnectStarted());
    await bloc.stream.first;
    return bloc;
  }

  setUp(() {
    adapter = MockHttpClientAdapter();
    registry = FakeDaemonRegistry(
      daemons: <Daemon>[fakeDaemon()],
      selected: kFakeDaemonId,
    );
    credentials = FakeDaemonCredentialStore();
  });

  group('ConnectBloc', () {
    group('ConnectStarted', () {
      test('should render the unselected state when no daemon is selected', () async {
        // Arrange
        registry = FakeDaemonRegistry();
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectStarted());
        final state = await bloc.stream.first;

        // Assert
        expect(state, isA<ConnectUnselected>());
        expect(adapter.requests, isEmpty);
      });

      test('should render the unselected state when the selected id matches no entry', () async {
        // Arrange
        registry = FakeDaemonRegistry(daemons: <Daemon>[fakeDaemon()], selected: 'gone');
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectStarted());
        final state = await bloc.stream.first;

        // Assert
        expect(state, isA<ConnectUnselected>());
      });

      test('should open on the selected daemon when the registry holds one', () async {
        // Arrange
        credentials.tokens[kFakeDaemonId] = 'stored-token';
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectStarted());
        final state = await bloc.stream.first;

        // Assert
        expect(state, isA<ConnectIdle>());
        final target = targetOf(state)!;
        expect(target.daemonId, kFakeDaemonId);
        expect(target.daemonName, kFakeDaemonName);
        expect(target.baseUrl, kFakeBaseUrl);
        expect(target.token, 'stored-token');
        expect(adapter.requests, isEmpty);
      });

      test('should open on an empty token when the credential store holds none', () async {
        // Arrange
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectStarted());
        final state = await bloc.stream.first;

        // Assert
        expect(targetOf(state)!.token, '');
      });
    });

    group('ConnectProbeRequested', () {
      test('should reach the connected state when the daemon answers the health body', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = await started();
        bloc.add(const ConnectTokenChanged(_kToken));
        await bloc.stream.first;

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[0], isA<ConnectProbing>());
        expect(states[1], isA<ConnectConnected>());
        expect((states[1] as ConnectConnected).health.dependencies.single.name, 'storage');
      });

      test('should reach the token outcome when the daemon answers 401', () async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('unauthenticated', 'the token is wrong'), 401);
        final bloc = await started();

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectTokenRejected>());
        expect(targetOf(states[1])!.daemonName, kFakeDaemonName);
      });

      test('should reach the daemon outcome when the daemon answers 403 host-forbidden', () async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('host-forbidden', 'the host is not allowed'), 403);
        final bloc = await started();

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectDaemonRejected>());
        expect((states[1] as ConnectDaemonRejected).host, 'localhost:31415');
        expect((states[1] as ConnectDaemonRejected).configKey, 'KANTHORD_HTTP_ALLOWED_HOSTS');
      });

      test('should reach the daemon outcome when the daemon answers 403 origin-forbidden', () async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('origin-forbidden', 'the origin is not allowed'), 403);
        final bloc = await started();

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
        final bloc = await started();

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectUnreachable>());
        expect((states[1] as ConnectUnreachable).isOpaque, isFalse);
      });

      test('should send no request when no daemon is selected', () async {
        // Arrange
        registry = FakeDaemonRegistry();
        final bloc = buildBloc();
        addTearDown(bloc.close);

        // Act
        bloc.add(const ConnectProbeRequested());
        await Future<void>.delayed(Duration.zero);

        // Assert
        expect(bloc.state, isA<ConnectUnselected>());
        expect(adapter.requests, isEmpty);
      });

      test('should probe one time when the button is pressed twice in a row', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = await started();

        // Act
        bloc.add(const ConnectProbeRequested());
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();
        await Future<void>.delayed(Duration.zero);

        // Assert
        expect(states[1], isA<ConnectConnected>());
        expect(adapter.requests, hasLength(1));
      });

      test('should send no request when the base URL is not usable', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = await started();
        bloc.add(const ConnectBaseUrlChanged('not a url'));
        await bloc.stream.first;

        // Act
        bloc.add(const ConnectProbeRequested());
        await Future<void>.delayed(Duration.zero);

        // Assert
        expect(bloc.state, isA<ConnectIdle>());
        expect(adapter.requests, isEmpty);
      });

      test('should report a storage failure and restore both values when the credential write '
          'fails', () async {
        // Arrange
        credentials.tokens[kFakeDaemonId] = 'the-working-token';
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = await started();
        bloc.add(const ConnectBaseUrlChanged('http://127.0.0.1:31415'));
        await bloc.stream.first;
        credentials.failSave = true;

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectStorageFailed>());
        expect((await registry.selected())!.baseUrl, kFakeBaseUrl);
        expect((await registry.selected())!.confirmedAt, isNull);
        expect(credentials.tokens[kFakeDaemonId], 'the-working-token');
      });

      test('should report a storage failure and keep the credential when the registry write '
          'fails', () async {
        // Arrange
        credentials.tokens[kFakeDaemonId] = 'the-working-token';
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = await started();
        bloc.add(const ConnectTokenChanged('a-new-token'));
        await bloc.stream.first;
        registry.failUpdate = true;

        // Act
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectStorageFailed>());
        expect(credentials.tokens[kFakeDaemonId], 'the-working-token');
      });
    });

    group('ConnectDaemonEdited', () {
      test('should replace the name and the base URL when the dialog returns them', () async {
        // Arrange
        final bloc = await started();

        // Act
        bloc.add(const ConnectDaemonEdited(name: 'vps', baseUrl: 'http://10.0.2.2:31415'));
        final state = await bloc.stream.first;

        // Assert
        final target = targetOf(state)!;
        expect(target.daemonName, 'vps');
        expect(target.baseUrl, 'http://10.0.2.2:31415');
        expect(target.daemonId, kFakeDaemonId);
      });
    });

    group('ConnectTokenCleared', () {
      test('should delete the credential of the selected daemon when the human clears it '
          'explicitly', () async {
        // Arrange
        credentials.tokens[kFakeDaemonId] = 'stored-token';
        credentials.tokens['daemon-2'] = 'another-token';
        final bloc = await started();

        // Act
        bloc.add(const ConnectTokenCleared());
        final state = await bloc.stream.first;

        // Assert
        expect(targetOf(state)!.token, '');
        expect(credentials.tokens.containsKey(kFakeDaemonId), isFalse);
        expect(credentials.tokens['daemon-2'], 'another-token');
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
import 'package:kanthord/features/daemon_connect/connect/connect_bloc.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_event.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_state.dart';

import '../../../api/dio_mock_adapter.dart';
import '../daemon_fakes.dart';

const String _kEnteredBaseUrl = 'http://127.0.0.1:31415';
const String _kEnteredToken = 'a-token';
const String _kStoredToken = 'the-working-token';

final DateTime _kConfirmedAt = DateTime.utc(2026, 8, 10);

const Map<String, dynamic> _kHealthBody = <String, dynamic>{
  'status': 'ok',
  'dependencies': <dynamic>[],
};

const Map<String, dynamic> _kUnauthenticatedBody = <String, dynamic>{
  'error': <String, dynamic>{'code': 'unauthenticated', 'message': 'the token is wrong'},
};

void main() {
  late MockHttpClientAdapter adapter;
  late FakeDaemonRegistry registry;
  late FakeDaemonCredentialStore credentials;

  ConnectBloc buildBloc() => ConnectBloc(
    api: fakeApi(adapter),
    registry: registry,
    credentials: credentials,
    isWeb: false,
    now: () => _kConfirmedAt,
  );

  Future<ConnectState> probe() async {
    final bloc = buildBloc();
    addTearDown(bloc.close);
    bloc.add(const ConnectStarted());
    await bloc.stream.first;
    bloc.add(const ConnectBaseUrlChanged(_kEnteredBaseUrl));
    await bloc.stream.first;
    bloc.add(const ConnectTokenChanged(_kEnteredToken));
    await bloc.stream.first;
    bloc.add(const ConnectProbeRequested());
    final states = await bloc.stream.take(2).toList();
    return states[1];
  }

  setUp(() {
    adapter = MockHttpClientAdapter();
    registry = FakeDaemonRegistry(
      daemons: <Daemon>[fakeDaemon()],
      selected: kFakeDaemonId,
    );
    credentials = FakeDaemonCredentialStore();
  });

  group('the candidate probe', () {
    group('the request', () {
      test('should send the entered base URL and the entered token when the probe runs', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);

        // Act
        await probe();

        // Assert
        expect(adapter.requests, hasLength(1));
        expect(adapter.requests.single.uri.toString(), '$_kEnteredBaseUrl/v1/health');
        expect(adapter.requests.single.headers['Authorization'], 'Bearer $_kEnteredToken');
      });

      test('should pin the candidate daemon id on the request when the probe runs', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);

        // Act
        await probe();

        // Assert
        expect(adapter.requests.single.extra['kanthord.daemonId'], 'kanthord.candidate');
      });
    });

    group('a proven candidate', () {
      test('should commit the entered base URL to the daemon entry when the daemon answers '
          '200', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);

        // Act
        final state = await probe();

        // Assert
        expect(state, isA<ConnectConnected>());
        expect((await registry.selected())!.baseUrl, _kEnteredBaseUrl);
      });

      test('should set confirmedAt when the daemon answers 200', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);

        // Act
        await probe();

        // Assert
        expect((await registry.selected())!.confirmedAt, _kConfirmedAt);
      });

      test('should commit the entered token under the daemon id when the daemon answers '
          '200', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);

        // Act
        await probe();

        // Assert
        expect(credentials.tokens[kFakeDaemonId], _kEnteredToken);
      });

      test('should keep the daemon id when the base URL is replaced', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);

        // Act
        await probe();

        // Assert
        expect((await registry.selected())!.id, kFakeDaemonId);
      });
    });

    group('a rejected candidate', () {
      test('should leave the stored token in place when the daemon answers 401', () async {
        // Arrange
        credentials.tokens[kFakeDaemonId] = _kStoredToken;
        adapter.respond = (options) => jsonResponse(_kUnauthenticatedBody, 401);

        // Act
        final state = await probe();

        // Assert
        expect(state, isA<ConnectTokenRejected>());
        expect(credentials.tokens[kFakeDaemonId], _kStoredToken);
      });

      test('should leave the daemon base URL in place when the daemon answers 401', () async {
        // Arrange
        credentials.tokens[kFakeDaemonId] = _kStoredToken;
        adapter.respond = (options) => jsonResponse(_kUnauthenticatedBody, 401);

        // Act
        await probe();

        // Assert
        expect((await registry.selected())!.baseUrl, kFakeBaseUrl);
      });

      test('should leave confirmedAt unset when the daemon answers 401', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kUnauthenticatedBody, 401);

        // Act
        await probe();

        // Assert
        expect((await registry.selected())!.confirmedAt, isNull);
        expect(registry.updates, 0);
      });

      test('should leave both stored values in place when the connection fails', () async {
        // Arrange
        credentials.tokens[kFakeDaemonId] = _kStoredToken;
        adapter.respond = (options) =>
            throw DioException(requestOptions: options, type: DioExceptionType.connectionError);

        // Act
        final state = await probe();

        // Assert
        expect(state, isA<ConnectUnreachable>());
        expect((await registry.selected())!.baseUrl, kFakeBaseUrl);
        expect(credentials.tokens[kFakeDaemonId], _kStoredToken);
      });
    });

    group('the candidate lifetime', () {
      test('should answer a second probe when the first candidate is closed', () async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        final bloc = buildBloc();
        addTearDown(bloc.close);
        bloc.add(const ConnectStarted());
        await bloc.stream.first;

        // Act
        bloc.add(const ConnectProbeRequested());
        await bloc.stream.take(2).toList();
        bloc.add(const ConnectProbeRequested());
        final states = await bloc.stream.take(2).toList();

        // Assert
        expect(states[1], isA<ConnectConnected>());
        expect(adapter.requests, hasLength(2));
      });
    });
  });
}
```

## Constraints

- **The bloc takes the registered `KanthordApi` and probes a candidate.** It calls
  `_api.withCandidate(baseUrl:, token:)` per press, and it closes the candidate in `finally`. The
  registered client is never used to issue a request from this bloc, and it is never mutated.
  EPIC 001.1 G7.
- **`ProbeClientBuilder` does not exist and neither does
  `lib/features/daemon_connect/connect/candidate_client.dart`.** Write no
  `CandidateBaseUrlProvider` and no `CandidateTokenProvider`. EPIC 001.1 `StaticBaseUrlProvider` and
  `StaticTokenProvider` already serve that role inside `withCandidate`.
- **The transport seam is `adapterFactory`, never a mock of `KanthordApi`.** `KanthordApi` and
  `SystemResource` are `final class`, so neither can be implemented outside `lib/api/`.
  `fakeApi` passes `adapterFactory: () => adapter`, the parent hands the same factory to every
  candidate, and the candidate's request therefore lands in `adapter.requests`.
  `docs/testing.md:43-47` and `:62-64`.
- The bloc mocks no repository. None exists. `docs/testing.md:48`.
- No `@GenerateMocks` and no `.mocks.dart` in this Story. No test file here runs `make generate-test`.
- **Single flight.** `_onProbeRequested` returns immediately while `state is ConnectProbing`, so two
  presses build one candidate and send one request. `_onBaseUrlChanged`, `_onTokenChanged` and
  `_onDaemonEdited` return the same way, so an in-flight probe always commits the values it started
  with.
- **Every handler returns early when `targetOf(state)` is `null`.** No handler acts while no daemon
  is selected, and none of them calls a daemon. EPIC G9.
- **The commit order is fixed:** `registry.update` then `credentials.save`, and both run only after
  `health()` returns.
- **The commit is restorable.** `_commit` reads the previous `Daemon` and the previous token first. A
  write that raises restores both and answers `false`. The bloc then emits `ConnectStorageFailed`,
  never `connected`. `_restoreQuietly` swallows a second failure, because there is nothing left to
  try.
- **`confirmedAt` comes from the injected `now`.** The default is `_systemNow`; every test passes a
  fixed `DateTime.utc(2026, 8, 10)`, so the committed value is asserted exactly and the suite is
  deterministic. Never call `DateTime.now()` inside a handler.
- **`confirmedAt` travels inside the same `registry.update` call as `name` and `baseUrl`.** The
  commit is two awaited writes, not three: one entry write carrying all three fields, and one
  credential write. `select` is never called, because the daemon is already the selected one.
- **An unusable base URL never reaches `Dio`.** `_onProbeRequested` returns before it builds a
  candidate. The page of Story 08 also disables the button.
- A failure path writes nothing to either store. `docs/api/auth.md:52` — "Do not clear the stored
  token on a 401." `registry.updates` is asserted at `0` after a `401` to prove it.
- The bloc catches `ApiException` from the probe and `Exception` from the two stores. It does not
  catch `Object` and it does not catch `StateError`.
- `candidate.dio.close(force: true)` runs in `finally`, so a probe client leaks no connection.
- No automatic retry. `ConnectProbeRequested` is the only path that calls `health()`.
- The bloc reads no `Env`. The base URL prefill is the registry seed of EPIC 002 G5, so the
  convention reaches this bloc as the selected daemon's `baseUrl` and never as a fallback here.
- The bloc holds no comment and hard-codes no design value.

## Verify

- `make test-one T=test/features/daemon_connect/connect/connect_bloc_test.dart` exits 0.
- `make test-one T=test/features/daemon_connect/connect/connect_candidate_test.dart` exits 0.
- `make verify` exits 0.
- Proof: `PASS 003-G2-BLOC` and `PASS 003-G3-CANDIDATE`.

## Tasks

### Task 004.1 — the fakes, the bloc test and the candidate test

**Input:** `test/features/daemon_connect/daemon_fakes.dart`,
`test/features/daemon_connect/connect/connect_bloc_test.dart`,
`test/features/daemon_connect/connect/connect_candidate_test.dart`

**Action — RED:** write the three files verbatim. Run no codegen.

**Action — GREEN:** Task 004.2 creates the seam.

### Task 004.2 — the events and the bloc

**Input:** `lib/features/daemon_connect/connect/connect_event.dart`,
`lib/features/daemon_connect/connect/connect_bloc.dart`

**Action — GREEN:** write the two files verbatim.

**Action — REFACTOR:** none.
