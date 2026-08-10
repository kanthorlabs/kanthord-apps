# Story 08 — the router

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story `07` (`getIt`, `ThemeModeController` and `DaemonRegistryType` registered).

## Change

### Human pre-step — `build.yaml`. **APPLIED**

`scripts/lane-check.sh:43` denies `build.yaml` to every role. `build.yaml:21-25` already runs
`go_router_builder` over `lib/app/**_routes.dart` and `lib/features/**_routes.dart`, so
`make generate-lib` writes `lib/app/app_routes.g.dart`. No further change is needed for this Story.
Story `03` carries the one `build.yaml` change that is still outstanding.

### `lib/**`

- New `lib/app/pages/boot_page.dart`:

  ```dart
  import 'package:flutter/material.dart';

  import '../../libraries/kd_design_system/layout/kd_full_screen_layout.dart';
  import '../../libraries/kd_design_system/layout/kd_status_view.dart';
  import '../injection.dart';
  import '../settings/daemon.dart';
  import '../settings/daemon_registry.dart';

  final class BootPage extends StatelessWidget {
    const BootPage({super.key});

    @override
    Widget build(BuildContext context) {
      return FutureBuilder<Daemon?>(
        future: getIt<DaemonRegistryType>().selected(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const KDFullScreenLayout(
              child: KDStatusView(kind: KDStatusKind.loading, title: 'Starting KanthorD'),
            );
          }
          final daemon = snapshot.data;
          if (daemon == null) {
            return const KDFullScreenLayout(
              child: KDStatusView(
                kind: KDStatusKind.empty,
                title: 'No daemon selected',
                message: 'Select a daemon to continue.',
              ),
            );
          }
          return KDFullScreenLayout(
            child: KDStatusView(
              kind: KDStatusKind.notImplemented,
              title: daemon.name,
              message: daemon.baseUrl,
            ),
          );
        },
      );
    }
  }
  ```

- New `lib/app/pages/unauthorized_page.dart`:

  ```dart
  import 'package:flutter/material.dart';

  import '../../libraries/kd_design_system/layout/kd_full_screen_layout.dart';
  import '../../libraries/kd_design_system/layout/kd_status_view.dart';

  final class UnauthorizedPage extends StatelessWidget {
    const UnauthorizedPage({super.key});

    @override
    Widget build(BuildContext context) {
      return const KDFullScreenLayout(
        child: KDStatusView(
          kind: KDStatusKind.error,
          title: 'Not authorized',
          message: 'The daemon rejected the token.',
        ),
      );
    }
  }
  ```

- New `lib/app/app_routes.dart`:

  ```dart
  import 'package:flutter/material.dart';
  import 'package:go_router/go_router.dart';

  import '../libraries/kd_design_system/gallery/kd_gallery_page.dart';
  import 'injection.dart';
  import 'pages/boot_page.dart';
  import 'pages/unauthorized_page.dart';
  import 'theme_mode_controller.dart';

  part 'app_routes.g.dart';

  @TypedGoRoute<BootRoute>(path: '/')
  final class BootRoute extends GoRouteData with $BootRoute {
    const BootRoute();

    @override
    Widget build(BuildContext context, GoRouterState state) => const BootPage();
  }

  @TypedGoRoute<UnauthorizedRoute>(path: '/unauthorized')
  final class UnauthorizedRoute extends GoRouteData with $UnauthorizedRoute {
    const UnauthorizedRoute();

    @override
    Widget build(BuildContext context, GoRouterState state) => const UnauthorizedPage();
  }

  @TypedGoRoute<GalleryRoute>(path: '/gallery')
  final class GalleryRoute extends GoRouteData with $GalleryRoute {
    const GalleryRoute();

    @override
    Widget build(BuildContext context, GoRouterState state) =>
        KDGalleryPage(onThemeModeChanged: (mode) => getIt<ThemeModeController>().value = mode);
  }
  ```

- New `lib/app/router.dart`:

  ```dart
  import 'package:go_router/go_router.dart';

  import 'app_routes.dart' as app;

  GoRouter buildAppRouter() => GoRouter(routes: <RouteBase>[...app.$appRoutes]);
  ```

- Replace `lib/app/kanthord_app.dart:1-26` in full:

  ```dart
  import 'package:flutter/material.dart';
  import 'package:go_router/go_router.dart';

  import '../libraries/kd_design_system/styles/kd_theme.dart';
  import 'injection.dart';
  import 'router.dart';
  import 'theme_mode_controller.dart';

  final class KanthorDApp extends StatefulWidget {
    const KanthorDApp({super.key});

    @override
    State<KanthorDApp> createState() => _KanthorDAppState();
  }

  class _KanthorDAppState extends State<KanthorDApp> {
    final GoRouter _router = buildAppRouter();
    final ThemeModeController _themeMode = getIt<ThemeModeController>();

    @override
    Widget build(BuildContext context) {
      return ValueListenableBuilder<ThemeMode>(
        valueListenable: _themeMode,
        builder: (context, mode, _) => MaterialApp.router(
          title: 'KanthorD',
          theme: KDTheme.light(),
          darkTheme: KDTheme.dark(),
          themeMode: mode,
          routerConfig: _router,
        ),
      );
    }
  }
  ```

### Codegen

The software-engineer runs `make generate-lib` after writing `lib/app/app_routes.dart`. The expected
diff adds `lib/app/app_routes.g.dart`, and that file is committed. `go_router_builder` 4.4.0 emits one
`mixin $<Name> on GoRouteData` per annotated class and one top-level
`List<RouteBase> get $appRoutes` **per annotated library**. Never `make generate`.

## Constraints

- Three routes and no more. No connect route, no settings route, no daemon list and no product
  destination. **EPIC 003 and EPIC 003.1 declare theirs in their own feature library**,
  `lib/features/<name>/<name>_routes.dart`, which `build.yaml:21-25` already generates for.
  `$appRoutes` is a top-level member of each annotated library, so two libraries collide only when
  both are imported unprefixed. `lib/app/router.dart` therefore imports `app_routes.dart` under the
  `app` prefix and spreads it, and a later EPIC adds its own prefixed import and one more spread.
- `test/app/router_test.dart` imports `app_routes.dart` under the same `app` prefix, so a later EPIC
  adds a second prefixed import and touches no existing reference.
- **`BootPage` is a placeholder that EPIC 003 replaces.** EPIC 003 Story 09 rewrites its body to
  resolve the `/connect` destination and drops the registry read, because the connect screen owns the
  unselected state. That is a supersession, not a regression: **all five cases of
  `group('BootRoute')` in Task 008.1 belong to this EPIC's placeholder**, and EPIC 003 replaces the
  whole group. Two of them break outright once `/` resolves to `/connect`, because the literal
  `No daemon selected` is then unreachable. **Three of them would otherwise pass by accident** — the
  connect screen renders the daemon name and holds the base URL in a `TextField` that `find.text`
  still matches, and `takeException()` stays null — so a reviewer must read the replacement as
  removing five cases, never as three surviving.
- Every route class carries `@TypedGoRoute` and mixes the generated `$<Name>` mixin.
  `go_router_builder` 4.4.0 throws `Missing mixin clause` at build time without it. No bare `GoRoute`
  literal anywhere.
- No `Navigator.push`, `Navigator.pushNamed` or `Navigator.pushReplacement` in any hand-written file.
  `scripts/arch-check.sh:70-71` greps for all four forms.
- **`BootPage` calls no daemon.** It reads `selected()` and renders a `KDStatusView`. It runs no
  health probe, so it sets no `confirmedAt`.
- `BootPage` renders the unselected state as a normal state. It throws nothing when `selected()`
  answers `null`, which is G4 reaching the UI.
- `buildAppRouter()` returns a new `GoRouter` per call. `_KanthorDAppState` holds one in a field, so a
  rebuild reuses it.
- `KDGalleryPage` keeps a working theme toggle. `GalleryRoute` writes to `ThemeModeController`, which
  `KanthorDApp` listens to.
- `lib/app/` defines no `KD` symbol and hard-codes no colour, text style or radius. Both pages use
  `KDFullScreenLayout` plus `KDStatusView`, which `DESIGNS.md:110` names as the layout for a boot and
  an unauthorized screen.
- **Generated output is exempt from `arch-check`** through the `find` filter at
  `scripts/arch-check.sh:25-29`. The `$BootRoute` mixin `go_router_builder` writes contains
  `context.pushReplacement`, and it is never scanned.
- No comment in any file.

## Tasks

### Task 008.1 — the router test

**Input:** `test/app/router_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kanthord/app/app_routes.dart' as app;
import 'package:kanthord/app/injection.dart';
import 'package:kanthord/app/router.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/theme_mode_controller.dart';
import 'package:kanthord/libraries/kd_design_system/gallery/kd_gallery_page.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_status_view.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

const Size _kExpanded = Size(1280, 900);
const String _kRouteSource = 'lib/app/app_routes.dart';

int _countOf(String haystack, String needle) => needle.allMatches(haystack).length;

GoRouter _router(WidgetTester tester) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = _kExpanded;
  addTearDown(tester.view.reset);
  final router = buildAppRouter();
  addTearDown(router.dispose);
  return router;
}

Future<void> _pump(WidgetTester tester, GoRouter router) async {
  await tester.pumpWidget(
    MaterialApp.router(theme: KDTheme.light(), routerConfig: router),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    FlutterSecureStorage.setMockInitialValues(<String, String>{});
    await getIt.reset();
    configureDependencies(await SharedPreferences.getInstance());
  });

  tearDown(() async {
    await getIt.reset();
  });

  group('buildAppRouter', () {
    group('routes', () {
      test('should declare exactly the boot, unauthorized and gallery paths when the router '
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
        expect(paths, <String>{'/', '/unauthorized', '/gallery'});
      });

      test('should declare three top level routes when the router is built', () {
        // Arrange
        final router = buildAppRouter();
        addTearDown(router.dispose);

        // Act
        final routes = router.configuration.routes;

        // Assert
        expect(app.$appRoutes.length, 3);
        expect(routes.length, 3);
      });

      test('should type every declared route when the route source is read', () {
        // Arrange
        final source = File(_kRouteSource).readAsStringSync();

        // Act
        final annotated = _countOf(source, '@TypedGoRoute<');
        final declared = _countOf(source, 'extends GoRouteData');

        // Assert
        expect(annotated, 3);
        expect(declared, 3);
        expect(annotated, declared);
      });

      test('should declare no untyped GoRoute when the route source is read', () {
        // Arrange
        final source = File(_kRouteSource).readAsStringSync();

        // Act
        final untyped = _countOf(source, 'GoRoute(');

        // Assert
        expect(untyped, 0);
      });

      test('should mix the generated mixin on every route when the route source is read', () {
        // Arrange
        final source = File(_kRouteSource).readAsStringSync();

        // Act
        final mixed = _countOf(source, 'with \$');

        // Assert
        expect(mixed, 3);
      });
    });

    group('BootRoute', () {
      testWidgets('should render the unselected state when no daemon is selected', (tester) async {
        // Arrange
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(find.byType(KDStatusView), findsOneWidget);
        expect(find.text('No daemon selected'), findsOneWidget);
      });

      testWidgets('should render the unselected state when the selected id matches no entry', (
        tester,
      ) async {
        // Arrange
        final registry = getIt<DaemonRegistryType>();
        await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await registry.select('absent');
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(find.text('No daemon selected'), findsOneWidget);
      });

      testWidgets('should render the selected daemon when one is selected', (tester) async {
        // Arrange
        final registry = getIt<DaemonRegistryType>();
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await registry.select(added.id);
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(find.text('local'), findsOneWidget);
        expect(find.text('http://localhost:31415'), findsOneWidget);
      });

      testWidgets('should render the seeded daemon when the registry seeded one', (tester) async {
        // Arrange
        await getIt<DaemonRegistryType>().seedDefault();
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(find.text('http://localhost:31415'), findsOneWidget);
      });

      testWidgets('should throw no exception when no daemon is selected', (tester) async {
        // Arrange
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(tester.takeException(), isNull);
      });
    });

    group('UnauthorizedRoute', () {
      testWidgets('should render the error state when the location is /unauthorized', (
        tester,
      ) async {
        // Arrange
        final router = _router(tester);
        await _pump(tester, router);

        // Act
        router.go('/unauthorized');
        await tester.pumpAndSettle();

        // Assert
        expect(find.text('Not authorized'), findsOneWidget);
      });
    });

    group('GalleryRoute', () {
      testWidgets('should set the theme mode controller when the gallery reports a change', (
        tester,
      ) async {
        // Arrange
        final router = _router(tester);
        await _pump(tester, router);
        router.go('/gallery');
        await tester.pumpAndSettle();
        expect(find.byType(KDGalleryPage), findsOneWidget);
        expect(getIt<ThemeModeController>().value, ThemeMode.system);

        // Act
        tester.widget<KDGalleryPage>(find.byType(KDGalleryPage))
            .onThemeModeChanged(ThemeMode.dark);

        // Assert
        expect(getIt<ThemeModeController>().value, ThemeMode.dark);
      });
    });
  });
}
```

The five `test` cases of the `routes` group need no `WidgetTester`, so they build the router directly
and dispose it. `_router` exists for the `testWidgets` cases, which must also pin the `expanded` band
before the first pump.

**Action — GREEN:** the software-engineer's Task 008.2 creates the seam.

### Task 008.2 — the pages, the routes and the router

**Input:** `lib/app/pages/boot_page.dart`, `lib/app/pages/unauthorized_page.dart`,
`lib/app/app_routes.dart`, `lib/app/router.dart`, `lib/app/kanthord_app.dart`

**Action — GREEN:** write the five files exactly as the `## Change` section states, then run
`make generate-lib` and keep `lib/app/app_routes.g.dart`.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/router_test.dart` exits 0.
- `make arch-check` exits 0 and reports no `Navigator.push` hit.
- `make verify` exits 0.
- `NEEDS-HUMAN:` `make dev` opens `http://localhost:8080/` and shows the seeded daemon at
  `http://localhost:31415`, and `http://localhost:8080/gallery` shows the gallery with a working theme
  toggle. Story `10` owns the three-band check.
- Proof: `PASS 002-G7-ROUTER`, `PASS 002-G7-NAVIGATION`.
