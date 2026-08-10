# Story 09 — the routes and the splash entrypoint

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: Story 08 (`ConnectPage`), Story 04 (`ConnectBloc`), EPIC 002 (`lib/app/app_routes.dart`,
`lib/app/router.dart`, `lib/app/pages/boot_page.dart`, `lib/app/injection.dart`,
`test/app/router_test.dart`).

> **COORDINATION — reconciled 2026-08-10 against the finished EPIC 002 expansion.** This Story amends
> `test/app/router_test.dart`, which **EPIC 002 owns and writes**. The four edits below are anchored to
> that file's actual text: its `_pump` already passes `theme: KDTheme.light()`, it already imports
> `app_routes.dart` under the `app` prefix, and it already imports `kd_status_view.dart`,
> `daemon_registry.dart` and `kd_theme.dart`. **Two earlier edits are withdrawn as no-ops.** Change
> nothing in the file beyond these four edits.

`/` is the application entrypoint and it is the one place that holds routing conditions. Today it has
one destination, `/connect`. A later EPIC adds the unauthorized branch and the authentication branch
there, and nothing else in the tree decides where a cold start lands.

**The two `$appRoutes` symbols do not conflict.** `go_router_builder` emits one
`List<RouteBase> get $appRoutes` per annotated **library**, so EPIC 002's `lib/app/app_routes.dart`
emits one for its three routes and this Story's `lib/features/daemon_connect/daemon_connect_routes.dart`
emits a second for `/connect`. Dart allows both, because `lib/app/router.dart` imports each under a
prefix and spreads them into one list. Do **not** move `ConnectRoute` into `lib/app/app_routes.dart`:
`AGENTS.md` puts a feature's typed routes in `<name>_routes.dart` inside the feature, and
`build.yaml:21-25` already generates for `lib/features/**_routes.dart`.

**`lib/app/pages/boot_page.dart` is an EPIC 002 file and this Story replaces its whole body.** EPIC 002
writes it reading `getIt<DaemonRegistryType>().selected()` to render a placeholder. The replacement
below reads nothing and resolves one destination, so the registry read leaves the file. That is
deliberate: the connect screen already owns the unselected state, so a second reader would duplicate
the decision.

## Change

### `lib/**` — the feature routes

New file `lib/features/daemon_connect/daemon_connect_routes.dart`, verbatim:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../api/api.dart';
import '../../app/injection.dart';
import '../../app/settings/daemon_registry.dart';
import '../../app/token/daemon_credential_store.dart';
import 'connect/connect_bloc.dart';
import 'connect/connect_event.dart';
import 'connect/connect_page.dart';

part 'daemon_connect_routes.g.dart';

@TypedGoRoute<ConnectRoute>(path: '/connect')
final class ConnectRoute extends GoRouteData with $ConnectRoute {
  const ConnectRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return BlocProvider<ConnectBloc>(
      create: (_) => ConnectBloc(
        api: getIt<KanthordApi>(),
        registry: getIt<DaemonRegistryType>(),
        credentials: getIt<DaemonCredentialStoreType>(),
      )..add(const ConnectStarted()),
      child: const ConnectPage(),
    );
  }
}
```

New file `lib/features/daemon_connect/daemon_connect.dart`, verbatim:

```dart
export 'daemon_connect_routes.dart';
```

### `lib/**` — `lib/app/pages/boot_page.dart` becomes the entrypoint

EPIC 002 writes this file as a page that renders a placeholder and navigates nowhere. Replace the
whole file, verbatim:

```dart
import 'package:flutter/material.dart';

import '../../features/daemon_connect/daemon_connect.dart';
import '../../libraries/kd_design_system/layout/kd_full_screen_layout.dart';
import '../../libraries/kd_design_system/layout/kd_status_view.dart';

final class BootPage extends StatefulWidget {
  const BootPage({super.key});

  @override
  State<BootPage> createState() => _BootPageState();
}

class _BootPageState extends State<BootPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
  }

  void _resolve() {
    if (!mounted) return;
    const ConnectRoute().go(context);
  }

  @override
  Widget build(BuildContext context) {
    return const KDFullScreenLayout(
      child: KDStatusView(kind: KDStatusKind.loading, title: 'Starting KanthorD'),
    );
  }
}
```

`_resolve` is the condition site. It holds one destination now. It reads no registry, because the
connect screen already owns the unselected state, the prefill and the stored-value-wins rule, and
EPIC 003 forbids an automatic probe, so no condition here can distinguish a proven daemon from an
unproven one.

`lib/app/app_routes.dart` is **not changed**. `BootRoute` still builds `BootPage`, and every
annotation and `extends GoRouteData` stays. `lib/app/pages/unauthorized_page.dart` stays.

### `lib/**` — `lib/app/router.dart`

EPIC 002 writes `GoRouter buildAppRouter() => GoRouter(routes: $appRoutes);`. `go_router_builder`
4.4.0 emits one `$appRoutes` per annotated library, so the two libraries need two prefixes. The file
becomes, verbatim:

```dart
import 'package:go_router/go_router.dart';

import '../features/daemon_connect/daemon_connect.dart' as daemon_connect;
import 'app_routes.dart' as app;

GoRouter buildAppRouter() =>
    GoRouter(routes: <RouteBase>[...app.$appRoutes, ...daemon_connect.$appRoutes]);
```

### Codegen

The software-engineer runs `make generate-lib` and commits
`lib/features/daemon_connect/daemon_connect_routes.g.dart`. `lib/app/app_routes.g.dart` does not
change. `build.yaml:21-25` already runs `go_router_builder` over `lib/features/**_routes.dart`.

### `test/**` — amend `test/app/router_test.dart`

Four edits. Read the COORDINATION block above first. Nothing else in the file changes.

**Edit 1 — one import.** Add, in alphabetical position among the `package:kanthord` imports:

```dart
import 'package:kanthord/features/daemon_connect/connect/connect_page.dart';
```

Add nothing else. `app_routes.dart` is already imported `as app`, and `kd_status_view.dart`,
`kd_theme.dart` and `daemon_registry.dart` are already imported. Leave `_kRouteSource`, `_countOf`,
`_router` and `_pump` untouched: `_pump` already passes `theme: KDTheme.light()`.

**Edit 2 — the path set.** In `group('buildAppRouter') > group('routes')`, replace the whole test named
`'should declare exactly the boot, unauthorized and gallery paths when the router is built'` with:

```dart
      test('should declare the boot, unauthorized, gallery and connect paths when the router '
          'is built', () {
        // Arrange
        final router = buildAppRouter();
        addTearDown(router.dispose);

        // Act
        final paths = router.configuration.routes
            .whereType<GoRoute>()
            .map((route) => route.path)
            .toSet();

        // Assert
        expect(paths, <String>{'/', '/unauthorized', '/gallery', '/connect'});
      });
```

**Edit 3 — the counts.** Replace the whole test named
`'should declare three top level routes when the router is built'` with the one below. `app.$appRoutes`
stays `3`, because EPIC 002's library still declares three routes; only the composed router grows to
four. Leave the three source-reading tests —
`'should type every declared route when the route source is read'`,
`'should declare no untyped GoRoute when the route source is read'` and
`'should mix the generated mixin on every route when the route source is read'` — **untouched**: all
three read `lib/app/app_routes.dart` off disk through `_kRouteSource` and expect `3`, `0` and `3`, and
this Story adds no route to that file.

```dart
      test('should declare four top level routes when the router is built', () {
        // Arrange
        final router = buildAppRouter();
        addTearDown(router.dispose);

        // Act
        final routes = router.configuration.routes;

        // Assert
        expect(app.$appRoutes.length, 3);
        expect(routes.length, 4);
      });
```

**Edit 4 — the `BootRoute` group.** Replace the whole `group('BootRoute', …)` block — **all five of its
`testWidgets` cases** — with the three below. Those five assert EPIC 002's placeholder, which this
Story deletes: three of them look for the literal `'No daemon selected'` or read
`getIt<DaemonRegistryType>()` to render a name and a base URL in place, and the remaining two would
pass only by accident once `/` redirects to `/connect`. The named cases being removed are
`'should render the unselected state when no daemon is selected'`,
`'should render the unselected state when the selected id matches no entry'`,
`'should render the selected daemon when one is selected'`,
`'should render the seeded daemon when the registry seeded one'` and
`'should throw no exception when no daemon is selected'`. The unselected state is now asserted by
Story 08's `connect_page_test.dart`, which owns it.

```dart
    group('BootRoute', () {
      testWidgets('should render the starting state when the first frame is built', (
        tester,
      ) async {
        // Arrange
        final router = _router(tester);

        // Act
        await tester.pumpWidget(
          MaterialApp.router(theme: KDTheme.light(), routerConfig: router),
        );
        await tester.pump();

        // Assert
        expect(find.byType(KDStatusView), findsOneWidget);
        expect(find.text('Starting KanthorD'), findsOneWidget);
      });

      testWidgets('should route to the connect page when the entrypoint resolves', (
        tester,
      ) async {
        // Arrange
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(router.routerDelegate.currentConfiguration.uri.toString(), '/connect');
        expect(find.byType(ConnectPage), findsOneWidget);
      });

      testWidgets('should route to the connect page when the registry already holds a daemon', (
        tester,
      ) async {
        // Arrange
        await getIt<DaemonRegistryType>().add(name: 'local', baseUrl: 'http://localhost:31415');
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(router.routerDelegate.currentConfiguration.uri.toString(), '/connect');
      });
    });
```

The third test reuses the `daemon_registry.dart` import the file already carries. It proves the
entrypoint reaches `/connect` whether or not the registry already holds an entry, because `_resolve`
holds one destination and reads nothing.

**Withdrawn — the import block and the `_pump` theme.** The first draft of this Story carried two more
edits: one adding the `app` prefix plus the `KDTheme` and `kd_status_view` imports, and one adding
`theme: KDTheme.light()` to `_pump`. The finished EPIC 002 file already does both, so **both are
no-ops. Do not re-apply them.** `_pump` is correct as EPIC 002 writes it, and `ConnectPage`,
`KDFullScreenLayout` and `KDStatusView` all read `context.kdTokens`, which is
`Theme.of(this).extension<KDTokens>()!`
(`lib/libraries/kd_design_system/styles/kd_tokens.dart:235-237`), so that theme is load-bearing and
must not be removed.

The file's `setUp` already calls `configureDependencies` after
`SharedPreferences.setMockInitialValues` and `FlutterSecureStorage.setMockInitialValues`, with
`getIt.reset()` on both sides, so `getIt<KanthordApi>()`, `getIt<DaemonRegistryType>()` and
`getIt<DaemonCredentialStoreType>()` all resolve for the bloc `ConnectRoute` creates.

## Constraints

- `lib/features/daemon_connect/daemon_connect.dart` exports routes only. `AGENTS.md:185`.
- **The route creates the bloc and passes the three registered dependencies**:
  `getIt<KanthordApi>()`, `getIt<DaemonRegistryType>()` and `getIt<DaemonCredentialStoreType>()`.
  There is no `Dependencies` file, and the page creates no bloc.
- The route passes no `isWeb` and no `now`. Both take their production defaults, `kApiIsWeb` and
  `_systemNow`. Only a test pins them.
- The feature declares exactly one route. The settings destination is a `KDDialog` over the connect
  page (Story 07), and the unauthorized state is a `ConnectState` variant (Story 06).
  `/unauthorized` stays EPIC 002's route, and the splash gains its branch in a later EPIC.
- `BootPage` is the only file that decides where a cold start lands. No other page navigates on
  mount.
- `const ConnectRoute().go(context)` is the generated typed navigation. `scripts/arch-check.sh:70-71`
  bans `Navigator.push`, `pushNamed`, `pushReplacement` and `of(context).push`, and `go` is none of
  them.
- The post-frame callback checks `mounted` before it navigates.
- `lib/app/app_routes.dart` is untouched, so every EPIC 002 source grep over that file still passes.
- Neither new `lib/` file holds a comment. `lib/app/pages/boot_page.dart` is outside the `arch-check`
  comment filter (`:88-89` covers `lib/(api|features)/` only) and CLAUDE.md still forbids one.

## Verify

- `make test-one T=test/app/router_test.dart` exits 0.
- `make arch-check` exits 0 and prints `ARCH: PASS`.
- `make verify` exits 0.
- Proof: `PASS 003-G1-MECHANICAL`.
- `NEEDS-HUMAN:` `make dev`. Chrome at `http://localhost:8080` lands on the splash and reaches
  `/connect`, against a daemon holding `KANTHORD_HTTP_PORT=31415`, `KANTHORD_HTTP_TOKEN`,
  `KANTHORD_HTTP_ALLOWED_ORIGINS=http://localhost:8080` and
  `KANTHORD_HTTP_ALLOWED_HOSTS=127.0.0.1:31415,localhost:31415`. Prove a `200`, then a wrong token
  gives `401`, then a wrong origin gives `403 origin-forbidden`. **This one gates the epic.**
- `NEEDS-HUMAN:` the light theme and the dark theme at `expanded`, then `wide`, then `mobile`, by
  resizing the browser window.
- `NEEDS-HUMAN:` carried forward — a real daemon on macOS, and a real daemon from a physical device.
- `NEEDS-HUMAN:` `kApiIsWeb` resolves `true` in Chrome. Deferred from
  `.agent/plan/stories/001-transport-foundation/04-web-opaque-failure-message.md:81-86`, and the
  `make dev` run above discharges it.

## Tasks

### Task 009.1 — the router test amendment

**Input:** `test/app/router_test.dart`

**Action — RED:** apply Edit 1 through Edit 4. The anchors are reconciled against the finished EPIC 002
Story that writes this file; apply no withdrawn edit.

**Action — GREEN:** Task 009.2 creates the seam.

### Task 009.2 — the feature routes, the entrypoint and the router

**Input:** `lib/features/daemon_connect/daemon_connect_routes.dart`,
`lib/features/daemon_connect/daemon_connect.dart`, `lib/app/pages/boot_page.dart`,
`lib/app/router.dart`

**Action — GREEN:** write the four files verbatim, then run `make generate-lib` and commit
`daemon_connect_routes.g.dart`.

**Action — REFACTOR:** none.
