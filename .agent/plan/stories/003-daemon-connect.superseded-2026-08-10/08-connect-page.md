# Story 08 — the connect page

> **SUPERSEDED on 2026-08-10 — re-expand before implementing.** The product holds more than
> one daemon, and `KanthordApi.withCandidate` replaces `ProbeClientBuilder`. Read the STOP
> block in `index.md` for this file's delta specification. Everything below still shows the
> shape, the guards and the tests that survive.

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: Story 03 (`isCleartextRisk`), Story 04 (`ConnectBloc`), Story 05 (`HealthView`),
Story 06 (`UnauthorizedNotice`), Story 07 (`SettingsDialog`).

Atomic layer: a **page**. It defines no atom. `DESIGNS.md:110` assigns `KDFullScreenLayout` to the
connect screen.

## Change

### `lib/**`

New file `lib/features/daemon_connect/connect/connect_page.dart`, verbatim:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../libraries/kd_design_system/kd_design_system.dart';
import '../settings/settings_dialog.dart';
import 'base_url_rule.dart';
import 'cleartext_warning.dart';
import 'connect_bloc.dart';
import 'connect_event.dart';
import 'connect_state.dart';
import 'widgets/health_view.dart';
import 'widgets/unauthorized_notice.dart';

const String _kCleartextWarning =
    'This base URL is not loopback. The token crosses the network in clear text and it never '
    'expires.';

final class ConnectPage extends StatefulWidget {
  const ConnectPage({super.key});

  @override
  State<ConnectPage> createState() => _ConnectPageState();
}

class _ConnectPageState extends State<ConnectPage> {
  final TextEditingController _baseUrl = TextEditingController();
  final TextEditingController _token = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync(context, context.read<ConnectBloc>().state);
  }

  @override
  void dispose() {
    _baseUrl.dispose();
    _token.dispose();
    super.dispose();
  }

  void _sync(BuildContext context, ConnectState state) {
    if (_baseUrl.text != state.baseUrl) _baseUrl.text = state.baseUrl;
    if (_token.text != state.token) _token.text = state.token;
  }

  Future<void> _openSettings(BuildContext context, ConnectState state) async {
    final bloc = context.read<ConnectBloc>();
    final result = await KDDialog.show<SettingsValues>(
      context,
      builder: (_) => SettingsDialog(baseUrl: state.baseUrl, token: state.token),
    );
    if (result == null) return;
    bloc.add(ConnectBaseUrlChanged(result.baseUrl));
    if (result.token.isEmpty) {
      bloc.add(const ConnectTokenCleared());
    } else {
      bloc.add(ConnectTokenChanged(result.token));
    }
  }

  Widget _buildOutcome(ConnectState state) {
    return switch (state) {
      ConnectIdle() => const SizedBox.shrink(),
      ConnectProbing() => const KDStatusView(
        kind: KDStatusKind.loading,
        title: 'Probing the daemon',
      ),
      ConnectConnected(:final health) => HealthView(health: health),
      ConnectTokenRejected(:final detail) => UnauthorizedNotice(
        baseUrl: state.baseUrl,
        detail: detail,
      ),
      ConnectDaemonRejected(:final code, :final host, :final configKey) => KDStatusView(
        kind: KDStatusKind.error,
        title: 'The daemon refused the request',
        message: code == 'origin-forbidden'
            ? 'The daemon answered $code. Add this page origin to $configKey on the daemon.'
            : 'The daemon answered $code. It received the Host $host. Add $host to $configKey '
                  'on the daemon.',
      ),
      ConnectUnreachable(:final detail) => KDStatusView(
        kind: KDStatusKind.error,
        title: 'No answer from the daemon',
        message: detail,
      ),
      ConnectStorageFailed(:final detail) => KDStatusView(
        kind: KDStatusKind.error,
        title: 'The daemon answered, and the settings were not saved',
        message: detail,
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<ConnectBloc>();
    final tokens = context.kdTokens;
    return BlocConsumer<ConnectBloc, ConnectState>(
      listener: _sync,
      builder: (context, state) {
        final isProbing = state is ConnectProbing;
        return KDFullScreenLayout(
          footer: KDButton(
            label: 'Settings',
            variant: KDButtonVariant.text,
            onPressed: () => _openSettings(context, state),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KDInputField(
                label: 'Daemon base URL',
                controller: _baseUrl,
                helper: 'The daemon has no default port.',
                isEnabled: !isProbing,
                onChanged: (value) => bloc.add(ConnectBaseUrlChanged(value)),
              ),
              SizedBox(height: tokens.spacing.lg),
              KDInputField(
                label: 'Daemon token',
                controller: _token,
                isObscured: true,
                isEnabled: !isProbing,
                onChanged: (value) => bloc.add(ConnectTokenChanged(value)),
              ),
              SizedBox(height: tokens.spacing.lg),
              if (isCleartextRisk(state.baseUrl)) ...[
                const KDText(
                  _kCleartextWarning,
                  role: KDTextRole.bodySmall,
                  tone: KDTextTone.error,
                ),
                SizedBox(height: tokens.spacing.lg),
              ],
              KDButton(
                label: 'Connect',
                isBusy: isProbing,
                isEnabled: isUsableBaseUrl(state.baseUrl),
                onPressed: () => bloc.add(const ConnectProbeRequested()),
              ),
              SizedBox(height: tokens.spacing.xl),
              _buildOutcome(state),
            ],
          ),
        );
      },
    );
  }
}
```

### `test/**` — the page test

New file `test/features/daemon_connect/connect/connect_page_test.dart`, verbatim:

```dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:kanthord/features/daemon_connect/connect/candidate_client.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_bloc.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_event.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_page.dart';
import 'package:kanthord/features/daemon_connect/connect/widgets/health_view.dart';
import 'package:kanthord/features/daemon_connect/connect/widgets/unauthorized_notice.dart';
import 'package:kanthord/libraries/kd_design_system/atoms/kd_button.dart';
import 'package:kanthord/libraries/kd_design_system/atoms/kd_input_field.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../api/dio_mock_adapter.dart';

const Size _kExpanded = Size(1280, 900);

const Map<String, dynamic> _kHealthBody = <String, dynamic>{
  'status': 'degraded',
  'dependencies': <dynamic>[
    <String, dynamic>{'name': 'storage', 'status': 'ok'},
    <String, dynamic>{'name': 'git', 'status': 'failed'},
    <String, dynamic>{'name': 'agent', 'status': 'not-implemented'},
    <String, dynamic>{'name': 'cache', 'status': 'warming'},
  ],
};

Map<String, dynamic> _errorBody(String code, String message) => <String, dynamic>{
  'error': <String, dynamic>{'code': code, 'message': message},
};

Finder _fieldOf(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(TextField));

void main() {
  late MockHttpClientAdapter adapter;
  late BaseUrlStoreType baseUrls;
  late TokenProviderType tokens;
  late ConnectBloc bloc;

  KanthordApi buildProbe({required String baseUrl, required String token}) {
    final dio = Dio()..httpClientAdapter = adapter;
    return KanthordApi(
      config: ApiConfig(baseUrlProvider: CandidateBaseUrlProvider(baseUrl)),
      tokens: CandidateTokenProvider(token),
      dio: dio,
    );
  }

  Future<void> pump(WidgetTester tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = _kExpanded;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: KDTheme.light(),
        home: BlocProvider<ConnectBloc>.value(value: bloc, child: const ConnectPage()),
      ),
    );
    await tester.pumpAndSettle();
  }

  setUp(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues(<String, Object>{});
    baseUrls = PreferencesBaseUrlProvider(await SharedPreferences.getInstance());
    tokens = CandidateTokenProvider(null);
    adapter = MockHttpClientAdapter();
    bloc = ConnectBloc(
      tokens: tokens,
      baseUrls: baseUrls,
      probeClientBuilder: buildProbe,
      isWeb: false,
    );
    addTearDown(bloc.close);
  });

  group('ConnectPage', () {
    group('the base URL field', () {
      testWidgets('should show the convention when the store is empty', (tester) async {
        // Arrange
        bloc.add(const ConnectStarted());

        // Act
        await pump(tester);

        // Assert
        expect(
          tester.widget<TextField>(_fieldOf('Daemon base URL')).controller!.text,
          'http://localhost:31415',
        );
      });

      testWidgets('should send no request when the store is empty and nothing is confirmed', (
        tester,
      ) async {
        // Arrange
        bloc.add(const ConnectStarted());

        // Act
        await pump(tester);

        // Assert
        expect(adapter.requests, isEmpty);
      });

      testWidgets('should show the stored value when the store holds a base URL', (tester) async {
        // Arrange
        await baseUrls.save('http://192.168.1.24:31415');
        bloc.add(const ConnectStarted());

        // Act
        await pump(tester);

        // Assert
        expect(
          tester.widget<TextField>(_fieldOf('Daemon base URL')).controller!.text,
          'http://192.168.1.24:31415',
        );
      });

      testWidgets('should show the stored value when the bloc settled before the page mounts', (
        tester,
      ) async {
        // Arrange
        await baseUrls.save('http://192.168.1.24:31415');
        bloc.add(const ConnectStarted());
        await bloc.stream.first;

        // Act
        await pump(tester);

        // Assert
        expect(
          tester.widget<TextField>(_fieldOf('Daemon base URL')).controller!.text,
          'http://192.168.1.24:31415',
        );
      });
    });

    group('the token field', () {
      testWidgets('should obscure the token when the page opens', (tester) async {
        // Arrange
        bloc.add(const ConnectStarted());

        // Act
        await pump(tester);

        // Assert
        expect(tester.widget<TextField>(_fieldOf('Daemon token')).obscureText, isTrue);
        expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
      });

      testWidgets('should reveal the token when the reveal control is pressed', (tester) async {
        // Arrange
        bloc.add(const ConnectStarted());
        await pump(tester);

        // Act
        await tester.tap(find.byIcon(Icons.visibility_outlined));
        await tester.pumpAndSettle();

        // Assert
        expect(tester.widget<TextField>(_fieldOf('Daemon token')).obscureText, isFalse);
      });
    });

    group('the cleartext warning', () {
      testWidgets('should show no warning when the base URL is loopback', (tester) async {
        // Arrange
        bloc.add(const ConnectStarted());

        // Act
        await pump(tester);

        // Assert
        expect(find.textContaining('clear text'), findsNothing);
      });

      testWidgets('should warn when the base URL is not loopback', (tester) async {
        // Arrange
        bloc.add(const ConnectBaseUrlChanged('http://192.168.1.24:31415'));

        // Act
        await pump(tester);

        // Assert
        expect(find.textContaining('clear text'), findsOneWidget);
        expect(find.textContaining('never expires'), findsOneWidget);
      });
    });

    group('the Connect control', () {
      testWidgets('should offer Connect when the base URL is usable', (tester) async {
        // Arrange
        bloc.add(const ConnectStarted());

        // Act
        await pump(tester);

        // Assert
        expect(
          tester.widget<KDButton>(find.widgetWithText(KDButton, 'Connect')).isEnabled,
          isTrue,
        );
      });

      testWidgets('should refuse Connect when the base URL is not usable', (tester) async {
        // Arrange
        bloc.add(const ConnectBaseUrlChanged('not a url'));

        // Act
        await pump(tester);

        // Assert
        expect(
          tester.widget<KDButton>(find.widgetWithText(KDButton, 'Connect')).isEnabled,
          isFalse,
        );
        expect(adapter.requests, isEmpty);
      });
    });

    group('Connect', () {
      testWidgets('should render the roll-up and every dependency when the daemon answers 200', (
        tester,
      ) async {
        // Arrange
        adapter.respond = (options) => jsonResponse(_kHealthBody, 200);
        bloc.add(const ConnectStarted());
        await pump(tester);

        // Act
        await tester.tap(find.text('Connect'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(HealthView), findsOneWidget);
        expect(find.text('degraded'), findsOneWidget);
        expect(find.text('storage'), findsOneWidget);
        expect(find.text('not-implemented'), findsOneWidget);
        expect(find.text('warming'), findsOneWidget);
        expect(
          tester.getTopLeft(find.text('storage')).dy,
          lessThan(tester.getTopLeft(find.text('git')).dy),
        );
        expect(
          tester.getTopLeft(find.text('git')).dy,
          lessThan(tester.getTopLeft(find.text('agent')).dy),
        );
      });

      testWidgets('should render the unauthorized notice when the daemon answers 401', (
        tester,
      ) async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('unauthenticated', 'the token is wrong'), 401);
        bloc.add(const ConnectStarted());
        await pump(tester);

        // Act
        await tester.tap(find.text('Connect'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(UnauthorizedNotice), findsOneWidget);
        expect(find.text('http://localhost:31415'), findsWidgets);
        expect(tester.widget<KDInputField>(find.byType(KDInputField).last).isEnabled, isTrue);
      });

      testWidgets('should name the host and the host key when the daemon answers host-forbidden', (
        tester,
      ) async {
        // Arrange
        adapter.respond = (options) =>
            jsonResponse(_errorBody('host-forbidden', 'the host is not allowed'), 403);
        bloc.add(const ConnectStarted());
        await pump(tester);

        // Act
        await tester.tap(find.text('Connect'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.textContaining('KANTHORD_HTTP_ALLOWED_HOSTS'), findsOneWidget);
        expect(find.textContaining('Add localhost:31415'), findsOneWidget);
      });

      testWidgets(
        'should name the origin key and claim no value when the daemon answers origin-forbidden',
        (tester) async {
          // Arrange
          adapter.respond = (options) =>
              jsonResponse(_errorBody('origin-forbidden', 'the origin is not allowed'), 403);
          bloc.add(const ConnectStarted());
          await pump(tester);

          // Act
          await tester.tap(find.text('Connect'));
          await tester.pumpAndSettle();

          // Assert
          expect(find.textContaining('KANTHORD_HTTP_ALLOWED_ORIGINS'), findsOneWidget);
          expect(find.textContaining('Add this page origin'), findsOneWidget);
          expect(find.textContaining('Add localhost:31415'), findsNothing);
        },
      );

      testWidgets('should name the URL when the connection fails', (tester) async {
        // Arrange
        adapter.respond = (options) =>
            throw DioException(requestOptions: options, type: DioExceptionType.connectionError);
        bloc.add(const ConnectStarted());
        await pump(tester);

        // Act
        await tester.tap(find.text('Connect'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.text('No answer from the daemon'), findsOneWidget);
        expect(find.textContaining('no answer from the daemon at localhost:31415'), findsOneWidget);
      });
    });
  });
}
```

### `test/**` — the settings flow test

New file `test/features/daemon_connect/settings/settings_flow_test.dart`, verbatim. It lives beside
`settings_dialog_test.dart` so that `make test-one T=test/features/daemon_connect/settings` proves
the whole of G8, not the dialog alone.

```dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:kanthord/features/daemon_connect/connect/candidate_client.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_bloc.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_event.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_page.dart';
import 'package:kanthord/features/daemon_connect/connect/widgets/unauthorized_notice.dart';
import 'package:kanthord/libraries/kd_design_system/atoms/kd_input_field.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_dialog.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../api/dio_mock_adapter.dart';

const Size _kExpanded = Size(1280, 900);

Map<String, dynamic> _errorBody(String code, String message) => <String, dynamic>{
  'error': <String, dynamic>{'code': code, 'message': message},
};

Finder _fieldOf(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(TextField));

Finder _dialogFieldOf(String label) =>
    find.descendant(of: find.byType(KDDialog), matching: _fieldOf(label));

void main() {
  late MockHttpClientAdapter adapter;
  late BaseUrlStoreType baseUrls;
  late TokenProviderType tokens;
  late ConnectBloc bloc;

  KanthordApi buildProbe({required String baseUrl, required String token}) {
    final dio = Dio()..httpClientAdapter = adapter;
    return KanthordApi(
      config: ApiConfig(baseUrlProvider: CandidateBaseUrlProvider(baseUrl)),
      tokens: CandidateTokenProvider(token),
      dio: dio,
    );
  }

  Future<void> pump(WidgetTester tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = _kExpanded;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: KDTheme.light(),
        home: BlocProvider<ConnectBloc>.value(value: bloc, child: const ConnectPage()),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openSettings(WidgetTester tester) async {
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
  }

  setUp(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues(<String, Object>{});
    baseUrls = PreferencesBaseUrlProvider(await SharedPreferences.getInstance());
    tokens = CandidateTokenProvider(null);
    adapter = MockHttpClientAdapter();
    bloc = ConnectBloc(
      tokens: tokens,
      baseUrls: baseUrls,
      probeClientBuilder: buildProbe,
      isWeb: false,
    );
    addTearDown(bloc.close);
  });

  group('the settings destination', () {
    group('Replace', () {
      testWidgets('should replace both values when the dialog returns them', (tester) async {
        // Arrange
        bloc.add(const ConnectStarted());
        await pump(tester);
        await openSettings(tester);
        await tester.enterText(_dialogFieldOf('Daemon base URL'), 'http://10.0.2.2:31415');
        await tester.enterText(_dialogFieldOf('Daemon token'), 'a-new-token');

        // Act
        await tester.tap(find.text('Replace'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(KDDialog), findsNothing);
        expect(bloc.state.baseUrl, 'http://10.0.2.2:31415');
        expect(bloc.state.token, 'a-new-token');
        expect(
          tester.widget<TextField>(_fieldOf('Daemon base URL')).controller!.text,
          'http://10.0.2.2:31415',
        );
      });
    });

    group('Clear the token', () {
      testWidgets('should clear the stored token when the dialog clears it', (tester) async {
        // Arrange
        await tokens.save('a-token');
        bloc.add(const ConnectStarted());
        await pump(tester);
        await openSettings(tester);

        // Act
        await tester.tap(find.text('Clear the token'));
        await tester.pumpAndSettle();

        // Assert
        expect(bloc.state.token, '');
        expect(await tokens.token(), isNull);
      });

      testWidgets('should keep the base URL when the dialog clears the token', (tester) async {
        // Arrange
        await baseUrls.save('http://10.0.2.2:31415');
        await tokens.save('a-token');
        bloc.add(const ConnectStarted());
        await pump(tester);
        await openSettings(tester);

        // Act
        await tester.tap(find.text('Clear the token'));
        await tester.pumpAndSettle();

        // Assert
        expect(bloc.state.baseUrl, 'http://10.0.2.2:31415');
        expect(await baseUrls.read(), 'http://10.0.2.2:31415');
      });
    });

    group('the unauthorized state', () {
      testWidgets('should show the current base URL and keep the token when the daemon answers '
          '401', (tester) async {
        // Arrange
        await baseUrls.save('http://10.0.2.2:31415');
        await tokens.save('a-token');
        adapter.respond = (options) =>
            jsonResponse(_errorBody('unauthenticated', 'the token is wrong'), 401);
        bloc.add(const ConnectStarted());
        await pump(tester);

        // Act
        await tester.tap(find.text('Connect'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(UnauthorizedNotice), findsOneWidget);
        expect(find.text('http://10.0.2.2:31415'), findsWidgets);
        expect(await tokens.token(), 'a-token');
        expect(tester.widget<KDInputField>(find.byType(KDInputField).last).isEnabled, isTrue);
        expect(find.text('Clear the token'), findsNothing);
      });
    });
  });
}
```

## Constraints

- The page contains no API call. It reads state and dispatches events. `AGENTS.md:203-208`.
- The page creates no bloc. Story 09's route creates it.
- The two controllers live in the `State` and are disposed. `didChangeDependencies` seeds them from
  the state that is already current, and the `BlocConsumer` listener carries every later change, so
  the fields never depend on whether `ConnectStarted` settled before or after the mount.
- `_sync` writes into a controller only when the value differs, so a keystroke never re-enters the
  controller.
- The 403 message branches on `code`. It never tells the operator to add the daemon host to
  `KANTHORD_HTTP_ALLOWED_ORIGINS`: the value that key takes is the page origin, which is a different
  value (`docs/api/connectivity.md:121-123`).
- The probe runs on an explicit press. There is no automatic retry and no probe on `initState`.
- `Connect` is disabled while `isUsableBaseUrl(state.baseUrl)` is `false`, so an unusable value never
  reaches `Dio`. The bloc guards the same case, and the two guards are deliberate: the button states
  the rule to the human, and the bloc enforces it.
- The `switch` over `ConnectState` is exhaustive and lists `ConnectStorageFailed`. That state means
  the daemon answered `200` and the client failed to persist the pair, so its title says both things.
- Every design value comes from `context.kdTokens`. No `Color(0x`, no `Colors.`, no `TextStyle(`,
  no `BorderRadius.circular(<digit>)`.
- No `Navigator.push`. The settings destination uses `KDDialog.show`.
- The file holds no comment.

## Verify

- `make test-one T=test/features/daemon_connect/connect/connect_page_test.dart` exits 0.
- `make test-one T=test/features/daemon_connect/settings` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 003-G7-HEALTH-RENDER`, and `settings_flow_test.dart` completes `PASS 003-G8-SETTINGS`.

## Tasks

### Task 008.1 — the page test and the settings flow test

**Input:** `test/features/daemon_connect/connect/connect_page_test.dart`,
`test/features/daemon_connect/settings/settings_flow_test.dart`

**Action — RED:** write both files verbatim. Run no codegen.

**Action — GREEN:** Task 008.2 creates the seam.

### Task 008.2 — the connect page

**Input:** `lib/features/daemon_connect/connect/connect_page.dart`

**Action — GREEN:** write the file verbatim.

**Action — REFACTOR:** none.
