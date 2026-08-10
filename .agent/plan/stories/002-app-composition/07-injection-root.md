# Story 07 — the injection root

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story `04`, Story `05`, Story `06`. EPIC 001 (`lib/api/api.dart` exists) and EPIC 001.1
(the two contracts carry `endpoint()` and `tokenOf(id)`).

## Change

- New `lib/app/theme_mode_controller.dart`:

  ```dart
  import 'package:flutter/material.dart';

  final class ThemeModeController extends ValueNotifier<ThemeMode> {
    ThemeModeController() : super(ThemeMode.system);
  }
  ```

- New `lib/app/injection.dart`:

  ```dart
  import 'package:flutter/foundation.dart';
  import 'package:get_it/get_it.dart';
  import 'package:shared_preferences/shared_preferences.dart';

  import '../api/api.dart';
  import 'settings/daemon_registry.dart';
  import 'settings/selected_daemon_provider.dart';
  import 'theme_mode_controller.dart';
  import 'token/daemon_credential_store.dart';
  import 'token/memory_daemon_credential_store.dart';
  import 'token/secure_storage_daemon_credential_store.dart';

  final GetIt getIt = GetIt.instance;

  DaemonCredentialStoreType buildCredentialStore({required bool isWeb}) => isWeb
      ? MemoryDaemonCredentialStore()
      : const SecureStorageDaemonCredentialStore();

  void configureDependencies(SharedPreferences preferences) {
    getIt.registerLazySingleton<ThemeModeController>(ThemeModeController.new);
    getIt.registerLazySingleton<DaemonCredentialStoreType>(
      () => buildCredentialStore(isWeb: kIsWeb),
    );
    getIt.registerLazySingleton<DaemonRegistryType>(
      () => PreferencesDaemonRegistry(preferences, getIt<DaemonCredentialStoreType>()),
    );
    getIt.registerLazySingleton<SelectedDaemonProvider>(
      () => SelectedDaemonProvider(
        getIt<DaemonRegistryType>(),
        getIt<DaemonCredentialStoreType>(),
      ),
    );
    getIt.registerLazySingleton<BaseUrlProviderType>(() => getIt<SelectedDaemonProvider>());
    getIt.registerLazySingleton<TokenProviderType>(() => getIt<SelectedDaemonProvider>());
    getIt.registerLazySingleton<ApiConfig>(
      () => ApiConfig(baseUrlProvider: getIt<BaseUrlProviderType>()),
    );
    getIt.registerLazySingleton<KanthordApi>(
      () => KanthordApi(config: getIt<ApiConfig>(), tokens: getIt<TokenProviderType>()),
    );
  }
  ```

- Replace `lib/main.dart:1-7` in full:

  ```dart
  import 'package:flutter/material.dart';
  import 'package:shared_preferences/shared_preferences.dart';

  import 'app/injection.dart';
  import 'app/kanthord_app.dart';
  import 'app/settings/daemon_registry.dart';

  Future<void> main() async {
    WidgetsFlutterBinding.ensureInitialized();
    configureDependencies(await SharedPreferences.getInstance());
    await getIt<DaemonRegistryType>().seedDefault();
    runApp(const KanthorDApp());
  }
  ```

## Constraints

- `configureDependencies` is the one site that names a concrete type. `kIsWeb` appears here and
  nowhere else.
- **`BaseUrlProviderType` and `TokenProviderType` both resolve the one `SelectedDaemonProvider`
  instance.** Both factories return `getIt<SelectedDaemonProvider>()`, so `identical` holds and the
  two interceptors of EPIC 001.1 read one registry.
- The platform choice is `buildCredentialStore({required bool isWeb})`, a pure function, because
  `kIsWeb` is a compile-time constant that is always `false` under `flutter test`. Reading it inline
  would leave the web branch unprovable in the headless suite.
- Every registration is `registerLazySingleton`. No `registerFactory`, no `registerSingletonAsync`.
- `SharedPreferences` is resolved in `main` and passed in. `configureDependencies` awaits nothing and
  returns `void`.
- **`main()` awaits `seedDefault()` after `configureDependencies` and before `runApp`.** The first
  frame therefore never renders an empty registry. `configureDependencies` itself seeds nothing, so a
  test controls the seed.
- `ThemeModeController` is app-lifetime and never disposed, which is correct for a singleton that
  outlives every route. G7 keeps the development gallery route, and `KDGalleryPage` requires
  `onThemeModeChanged` at `lib/libraries/kd_design_system/gallery/kd_gallery_page.dart:22`, so the
  value must live outside widget state — a generated typed route builder is static and captures none.
- `lib/api/` gains nothing. The dependency runs one way.
- No comment in any file.

## Tasks

### Task 007.1 — the injection test

**Input:** `test/app/injection_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api.dart';
import 'package:kanthord/app/injection.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/settings/selected_daemon_provider.dart';
import 'package:kanthord/app/theme_mode_controller.dart';
import 'package:kanthord/app/token/daemon_credential_store.dart';
import 'package:kanthord/app/token/memory_daemon_credential_store.dart';
import 'package:kanthord/app/token/secure_storage_daemon_credential_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

  group('buildCredentialStore', () {
    test('should return the secure storage store when isWeb is false', () {
      // Arrange
      const isWeb = false;

      // Act
      final result = buildCredentialStore(isWeb: isWeb);

      // Assert
      expect(result, isA<SecureStorageDaemonCredentialStore>());
    });

    test('should return the memory store when isWeb is true', () {
      // Arrange
      const isWeb = true;

      // Act
      final result = buildCredentialStore(isWeb: isWeb);

      // Assert
      expect(result, isA<MemoryDaemonCredentialStore>());
    });
  });

  group('configureDependencies', () {
    group('KanthordApi', () {
      test('should return the same instance when the client is resolved twice', () {
        // Arrange
        final first = getIt<KanthordApi>();

        // Act
        final second = getIt<KanthordApi>();

        // Assert
        expect(identical(first, second), isTrue);
      });
    });

    group('ApiConfig', () {
      test('should return the same instance when the config is resolved twice', () {
        // Arrange
        final first = getIt<ApiConfig>();

        // Act
        final second = getIt<ApiConfig>();

        // Assert
        expect(identical(first, second), isTrue);
      });
    });

    group('SelectedDaemonProvider', () {
      test('should resolve one instance under both provider interfaces when both are '
          'resolved', () {
        // Arrange
        final baseUrlProvider = getIt<BaseUrlProviderType>();

        // Act
        final tokenProvider = getIt<TokenProviderType>();

        // Assert
        expect(identical(baseUrlProvider, tokenProvider), isTrue);
        expect(baseUrlProvider, isA<SelectedDaemonProvider>());
      });

      test('should resolve the same instance as the concrete type when the interface is '
          'resolved', () {
        // Arrange
        final concrete = getIt<SelectedDaemonProvider>();

        // Act
        final asInterface = getIt<BaseUrlProviderType>();

        // Assert
        expect(identical(concrete, asInterface), isTrue);
      });
    });

    group('DaemonRegistryType', () {
      test('should return the same instance when the registry is resolved twice', () {
        // Arrange
        final first = getIt<DaemonRegistryType>();

        // Act
        final second = getIt<DaemonRegistryType>();

        // Assert
        expect(identical(first, second), isTrue);
      });

      test('should hold an empty registry when nothing seeded it', () async {
        // Arrange
        final registry = getIt<DaemonRegistryType>();

        // Act
        final daemons = await registry.list();

        // Assert
        expect(daemons, isEmpty);
      });
    });

    group('DaemonCredentialStoreType', () {
      test('should return the same instance when the store is resolved twice', () {
        // Arrange
        final first = getIt<DaemonCredentialStoreType>();

        // Act
        final second = getIt<DaemonCredentialStoreType>();

        // Assert
        expect(identical(first, second), isTrue);
      });

      test('should resolve the secure storage store when the host is not web', () {
        // Arrange
        final registered = getIt.isRegistered<DaemonCredentialStoreType>();

        // Act
        final result = getIt<DaemonCredentialStoreType>();

        // Assert
        expect(registered, isTrue);
        expect(result, isA<SecureStorageDaemonCredentialStore>());
      });
    });

    group('ThemeModeController', () {
      test('should return the same instance when the controller is resolved twice', () {
        // Arrange
        final first = getIt<ThemeModeController>();

        // Act
        final second = getIt<ThemeModeController>();

        // Assert
        expect(identical(first, second), isTrue);
      });

      test('should hold the system mode when it is resolved', () {
        // Arrange
        final controller = getIt<ThemeModeController>();

        // Act
        final mode = controller.value;

        // Assert
        expect(mode, ThemeMode.system);
      });
    });

    group('the resolved endpoint', () {
      test('should return null when no daemon is selected', () async {
        // Arrange
        final config = getIt<ApiConfig>();

        // Act
        final endpoint = await config.endpoint();

        // Assert
        expect(endpoint, isNull);
      });

      test('should resolve the seeded daemon when the registry seeded one', () async {
        // Arrange
        await getIt<DaemonRegistryType>().seedDefault();

        // Act
        final endpoint = await getIt<ApiConfig>().endpoint();

        // Assert
        expect(endpoint, isNotNull);
        expect(endpoint!.id, 'd1');
        expect(endpoint.name, 'local');
      });

      test('should serve the new endpoint through the same client when the selection '
          'changes', () async {
        // Arrange
        final client = getIt<KanthordApi>();
        final registry = getIt<DaemonRegistryType>();
        final first = await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final second = await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await registry.select(first.id);
        final before = await getIt<ApiConfig>().endpoint();

        // Act
        await registry.select(second.id);
        final after = await getIt<ApiConfig>().endpoint();

        // Assert
        expect(before!.baseUrl, 'http://127.0.0.1:31415');
        expect(after!.baseUrl, 'http://10.0.0.2:31415');
        expect(identical(client, getIt<KanthordApi>()), isTrue);
      });
    });

    group('the resolved token', () {
      test('should read the credential of the pinned daemon when an id is asked', () async {
        // Arrange
        final registry = getIt<DaemonRegistryType>();
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await getIt<DaemonCredentialStoreType>().save(added.id, 'token-one');

        // Act
        final token = await getIt<TokenProviderType>().tokenOf(added.id);

        // Assert
        expect(token, 'token-one');
      });

      test('should return null when no daemon is selected', () async {
        // Arrange
        final tokens = getIt<TokenProviderType>();

        // Act
        final token = await tokens.token();

        // Assert
        expect(token, isNull);
      });
    });
  });
}
```

`package:flutter/material.dart` is imported because the file names `ThemeMode`. A Dart import is not
transitive, so importing `theme_mode_controller.dart` alone does not bring `ThemeMode` into scope.

**Action — GREEN:** the software-engineer's Task 007.2 creates the seam.

### Task 007.2 — the injection root and the entry point

**Input:** `lib/app/theme_mode_controller.dart`, `lib/app/injection.dart`, `lib/main.dart`

**Action — GREEN:** write the three files exactly as the `## Change` section states. `lib/main.dart`
is a full replacement of the current seven lines.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/injection_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- `NEEDS-HUMAN:` that `kIsWeb` is true in a Chrome build, so a web run resolves
  `MemoryDaemonCredentialStore`. `buildCredentialStore(isWeb: true)` is proved headless; the value
  `kIsWeb` takes in the real web target is not. `make dev` is the check, and Story `10` runs it.
- Proof: `PASS 002-G1-DI`.
