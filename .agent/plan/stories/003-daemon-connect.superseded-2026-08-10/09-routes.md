# Story 09 — the routes and the splash entrypoint

> **SUPERSEDED on 2026-08-10 — re-expand before implementing.** The product holds more than
> one daemon, and `KanthordApi.withCandidate` replaces `ProbeClientBuilder`. Read the STOP
> block in `index.md` for this file's delta specification. Everything below still shows the
> shape, the guards and the tests that survive.

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: Story 08 (`ConnectPage`), EPIC 002 (`lib/app/app_routes.dart`, `lib/app/router.dart`,
`lib/app/pages/boot_page.dart`, `test/app/router_test.dart`).

`/` is the application entrypoint and it is the one place that holds routing conditions. Today it
has one destination, `/connect`. A later EPIC adds the unauthorized branch and the authentication
branch there, and nothing else in the tree decides where a cold start lands.

The page keeps the EPIC 002 names `BootRoute` and `BootPage`, because `/` is unchanged and
`DESIGNS.md:110` already assigns `KDFullScreenLayout` to a boot screen. Rename it to `SplashRoute`
and `SplashPage` if you prefer the word; that is a one-line change in three files and it is not
required by anything here.

## Change

### `lib/**` — the feature routes

New file `lib/features/daemon_connect/daemon_connect_routes.dart`, verbatim:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../api/api.dart';
import '../../app/injection.dart';
import '../../app/settings/base_url_store.dart';
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
      create: (_) =>
          ConnectBloc(tokens: getIt<TokenProviderType>(), baseUrls: getIt<BaseUrlStoreType>())
            ..add(const ConnectStarted()),
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

EPIC 002 Story 04 writes this file as a `StatelessWidget` that reads the store and renders a
`notImplemented` placeholder (`.agent/plan/stories/002-app-composition/04-router.md:25-69`). It
navigates nowhere. Replace the whole file, verbatim:

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

`_resolve` is the condition site. It holds one destination now. It reads no store, because the
connect screen already owns the unset case, the prefill and the stored-value-wins rule, and EPIC 003
forbids an automatic probe, so no condition here can distinguish a proven configuration from an
unproven one.

`lib/app/app_routes.dart` is **not changed**. `BootRoute` still builds `BootPage`, and the three
annotations and three `extends GoRouteData` stay. `lib/app/pages/unauthorized_page.dart` stays.

### `lib/**` — `lib/app/router.dart`

EPIC 002 Story 04 writes `GoRouter buildAppRouter() => GoRouter(routes: $appRoutes);`
(`.agent/plan/stories/002-app-composition/04-router.md:135-143`). `go_router_builder` 4.4.0 emits one
`$appRoutes` per annotated library, so the two libraries need two prefixes. The file becomes,
verbatim:

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

EPIC 002 Story 04 writes this file (`.agent/plan/stories/002-app-composition/04-router.md:209-390`).
Five edits, and nothing else in the file changes.

**Edit 1 — the imports.** Replace

```dart
import 'package:kanthord/app/app_routes.dart';
```

with

```dart
import 'package:kanthord/app/app_routes.dart' as app;
import 'package:kanthord/features/daemon_connect/connect/connect_page.dart';
```

Keep `import 'package:kanthord/libraries/kd_design_system/layout/kd_status_view.dart';` — Edit 4 uses
it. Add `import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';` if it is not
already imported; Edit 5 uses it.

**Edit 2 — the path set.** Rename the test and replace its assert. The whole test becomes

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

**Edit 3 — the counts.** Replace the whole
`'should declare three top level routes when the router is built'` test with

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

**Edit 4 — the `BootRoute` group.** Replace the whole `group('BootRoute', …)` block with

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

      testWidgets('should route to the connect page when the store already holds a base URL', (
        tester,
      ) async {
        // Arrange
        await getIt<BaseUrlStoreType>().save('http://localhost:31415');
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(router.routerDelegate.currentConfiguration.uri.toString(), '/connect');
      });
    });
```

**Edit 5 — the theme.** EPIC 002's `_pump` builds `MaterialApp.router(routerConfig: router)` with no
theme. `ConnectPage` and `KDFullScreenLayout` read `context.kdTokens`, which is
`Theme.of(this).extension<KDTokens>()!` (`libraries/kd_design_system/styles/kd_tokens.dart:235-237`),
so an unthemed `MaterialApp` throws a null assertion the moment `/` resolves. `_pump` becomes

```dart
Future<void> _pump(WidgetTester tester, GoRouter router) async {
  await tester.pumpWidget(
    MaterialApp.router(theme: KDTheme.light(), routerConfig: router),
  );
  await tester.pumpAndSettle();
}
```

The `setUp` of the file already calls `configureDependencies`, so `getIt<TokenProviderType>()` and
`getIt<BaseUrlStoreType>()` resolve for the bloc `ConnectRoute` creates.

## Constraints

- `lib/features/daemon_connect/daemon_connect.dart` exports routes only. `AGENTS.md:185`.
- The route creates the bloc. There is no `Dependencies` file, and the page creates no bloc.
- The feature declares exactly one route. The settings destination is a `KDDialog` over the connect
  page (Story 07), and the unauthorized state is a `ConnectState` variant (Story 06).
  `/unauthorized` stays EPIC 002's route, and the splash gains its branch in a later EPIC.
- `BootPage` is the only file that decides where a cold start lands. No other page navigates on
  mount.
- `const ConnectRoute().go(context)` is the generated typed navigation. `scripts/arch-check.sh:70-71`
  bans `Navigator.push`, `pushNamed`, `pushReplacement` and `of(context).push`, and `go` is none of
  them.
- The post-frame callback checks `mounted` before it navigates.
- `lib/app/app_routes.dart` is untouched, so the two source greps of `test/app/router_test.dart`
  still pass unchanged.
- Neither new `lib/` file holds a comment. `lib/app/pages/boot_page.dart` is outside the
  `arch-check` comment filter and CLAUDE.md still forbids one.

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

## Tasks

### Task 009.1 — the router test amendment

**Input:** `test/app/router_test.dart`

**Action — RED:** apply Edit 1 through Edit 5.

**Action — GREEN:** Task 009.2 creates the seam.

### Task 009.2 — the feature routes, the entrypoint and the router

**Input:** `lib/features/daemon_connect/daemon_connect_routes.dart`,
`lib/features/daemon_connect/daemon_connect.dart`, `lib/app/pages/boot_page.dart`,
`lib/app/router.dart`

**Action — GREEN:** write the four files verbatim, then run `make generate-lib` and commit
`daemon_connect_routes.g.dart`.

**Action — REFACTOR:** none.
