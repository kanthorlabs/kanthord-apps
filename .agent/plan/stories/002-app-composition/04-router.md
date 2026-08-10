# Story 04 — the router

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story 03 (`getIt`, `ThemeModeController`, `BaseUrlStoreType` registered).

## Change

### Human pre-step — `build.yaml`. **APPLIED**

`scripts/lane-check.sh:43` denies `build.yaml` to every role, so the human applied this before
dispatch. `build.yaml` limited `go_router_builder` to `lib/features/**_routes.dart`, and this EPIC
declares its routes under `lib/app/`. Without the added glob, `make generate-lib` writes no
`app_routes.g.dart` and the Story cannot compile. `build.yaml:21-25` now reads:

```yaml
go_router_builder:go_router_builder:
  enabled: true
  generate_for:
    - lib/app/**_routes.dart
    - lib/features/**_routes.dart
```

### `lib/**`

- New `lib/app/pages/boot_page.dart`:

  ```dart
  import 'package:flutter/material.dart';

  import '../../libraries/kd_design_system/layout/kd_full_screen_layout.dart';
  import '../../libraries/kd_design_system/layout/kd_status_view.dart';
  import '../injection.dart';
  import '../settings/base_url_store.dart';

  final class BootPage extends StatelessWidget {
    const BootPage({super.key});

    @override
    Widget build(BuildContext context) {
      return FutureBuilder<String?>(
        future: getIt<BaseUrlStoreType>().read(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const KDFullScreenLayout(
              child: KDStatusView(kind: KDStatusKind.loading, title: 'Starting KanthorD'),
            );
          }
          final stored = snapshot.data;
          if (stored == null) {
            return const KDFullScreenLayout(
              child: KDStatusView(
                kind: KDStatusKind.empty,
                title: 'No daemon configured',
                message: 'Enter the daemon base URL to continue.',
              ),
            );
          }
          return KDFullScreenLayout(
            child: KDStatusView(
              kind: KDStatusKind.notImplemented,
              title: 'Daemon configured',
              message: stored,
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

  import 'app_routes.dart';

  GoRouter buildAppRouter() => GoRouter(routes: $appRoutes);
  ```

- Replace `lib/app/kanthord_app.dart` in full:

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
diff adds `lib/app/app_routes.g.dart`, and that file is committed. Never `make generate`.

## Constraints

- Three routes and no more. No connect route, no settings route, no product destination. EPIC 003
  adds those to the same file.
- Every route class carries `@TypedGoRoute` and mixes the generated `$<Name>` mixin. No bare
  `GoRoute` literal anywhere.
- No `Navigator.push`, `Navigator.pushNamed` or `Navigator.pushReplacement` in any hand-written file.
- `KDGalleryPage` keeps a working theme toggle. `GalleryRoute` writes to `ThemeModeController`, which
  `KanthorDApp` listens to.
- `BootPage` calls no daemon. It reads the store and renders a `KDStatusView`.
- `buildAppRouter()` returns a new `GoRouter` per call. `_KanthorDAppState` holds one in a field, so
  a rebuild reuses it.
- `lib/app/` defines no `KD` symbol and hard-codes no colour, text style or radius. Both pages use
  `KDFullScreenLayout` plus `KDStatusView`, which `DESIGNS.md:110` names as the layout for a boot and
  an unauthorized screen.
- No comment in any file.

## Tasks

### Task 004.1 — the router test

**Input:** `test/app/router_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kanthord/app/app_routes.dart';
import 'package:kanthord/app/injection.dart';
import 'package:kanthord/app/router.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:kanthord/app/theme_mode_controller.dart';
import 'package:kanthord/libraries/kd_design_system/gallery/kd_gallery_page.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_status_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

const Size _kExpanded = Size(1280, 900);

int _countOf(String haystack, String needle) =>
    needle.allMatches(haystack).length;

GoRouter _router(WidgetTester tester) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = _kExpanded;
  addTearDown(tester.view.reset);
  final router = buildAppRouter();
  addTearDown(router.dispose);
  return router;
}

Future<void> _pump(WidgetTester tester, GoRouter router) async {
  await tester.pumpWidget(MaterialApp.router(routerConfig: router));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
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
        expect($appRoutes.length, 3);
        expect(routes.length, 3);
      });

      test('should type every declared route when the route source is read', () {
        // Arrange
        final source = File('lib/app/app_routes.dart').readAsStringSync();

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
        final source = File('lib/app/app_routes.dart').readAsStringSync();

        // Act
        final untyped = _countOf(source, 'GoRoute(');

        // Assert
        expect(untyped, 0);
      });
    });

    group('BootRoute', () {
      testWidgets('should render the unset state when the store holds no base URL', (tester) async {
        // Arrange
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(find.byType(KDStatusView), findsOneWidget);
        expect(find.text('No daemon configured'), findsOneWidget);
      });

      testWidgets('should render the configured state when the store holds a base URL', (
        tester,
      ) async {
        // Arrange
        await getIt<BaseUrlStoreType>().save('http://localhost:31415');
        final router = _router(tester);

        // Act
        await _pump(tester, router);

        // Assert
        expect(find.text('http://localhost:31415'), findsOneWidget);
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

The three `test` cases of the `routes` group need no `WidgetTester`, so they build the router
directly and dispose it. `_router` exists for the `testWidgets` cases, which must also pin the
`expanded` band before the first pump.

**Action — GREEN:** the software-engineer's Task 004.2 creates the seam.

### Task 004.2 — the pages, the routes and the router

**Input:** `lib/app/pages/boot_page.dart`, `lib/app/pages/unauthorized_page.dart`,
`lib/app/app_routes.dart`, `lib/app/router.dart`, `lib/app/kanthord_app.dart`

**Action — GREEN:** write the five files exactly as the `## Change` section states, then run
`make generate-lib` and commit `lib/app/app_routes.g.dart`.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/router_test.dart` exits 0.
- `make arch-check` exits 0 and reports no `Navigator.push` hit.
- `make verify` exits 0.
- `NEEDS-HUMAN:` `make dev` opens `http://localhost:8080/` and shows the unset boot state, and
  `http://localhost:8080/gallery` shows the gallery with a working theme toggle. Story 08 owns the
  three-band check.
- Proof: `PASS 002-G4-ROUTER`, `PASS 002-G4-NAVIGATION`.
