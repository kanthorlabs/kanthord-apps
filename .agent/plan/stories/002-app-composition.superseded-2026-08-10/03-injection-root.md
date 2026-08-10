# Story 03 — the injection root

> **SUPERSEDED on 2026-08-10 — do not implement.** The product holds more than one daemon.
> Read the STOP block in `index.md` and the re-authored `.agent/plan/epics/002-app-composition.md`.
> This file is the record of the scalar draft it replaced.

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story 01, Story 02. EPIC 001 Story 10 (`lib/api/api.dart` exists).

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
  import 'settings/base_url_store.dart';
  import 'theme_mode_controller.dart';
  import 'token/memory_token_provider.dart';
  import 'token/secure_storage_token_provider.dart';

  final GetIt getIt = GetIt.instance;

  TokenProviderType buildTokenProvider({required bool isWeb}) =>
      isWeb ? MemoryTokenProvider() : const SecureStorageTokenProvider();

  void configureDependencies(SharedPreferences preferences) {
    getIt.registerLazySingleton<ThemeModeController>(ThemeModeController.new);
    getIt.registerLazySingleton<BaseUrlStoreType>(
      () => PreferencesBaseUrlProvider(preferences),
    );
    getIt.registerLazySingleton<BaseUrlProviderType>(() => getIt<BaseUrlStoreType>());
    getIt.registerLazySingleton<TokenProviderType>(
      () => buildTokenProvider(isWeb: kIsWeb),
    );
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

  Future<void> main() async {
    WidgetsFlutterBinding.ensureInitialized();
    configureDependencies(await SharedPreferences.getInstance());
    runApp(const KanthorDApp());
  }
  ```

## Constraints

- `configureDependencies` is the one site that names a concrete provider type. `kIsWeb` appears here
  and nowhere else.
- The platform choice is `buildTokenProvider({required bool isWeb})`, a pure function, because
  `kIsWeb` is a compile-time constant that is always `false` under `flutter test`. Reading it inline
  would leave the web branch unprovable in the headless suite. The function takes the flag, so both
  branches are asserted.
- Every registration is `registerLazySingleton`. No `registerFactory`, no `registerSingletonAsync`.
- `SharedPreferences` is resolved in `main` and passed in. `configureDependencies` awaits nothing and
  returns `void`.
- `lib/api/` gains nothing. The dependency still runs one way.
- No comment in any file.

## Tasks

### Task 003.1 — the injection test

**Input:** `test/app/injection_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api.dart';
import 'package:kanthord/app/injection.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:kanthord/app/token/memory_token_provider.dart';
import 'package:kanthord/app/token/secure_storage_token_provider.dart';
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

  group('buildTokenProvider', () {
    test('should return the secure storage provider when isWeb is false', () {
      // Arrange
      const isWeb = false;

      // Act
      final result = buildTokenProvider(isWeb: isWeb);

      // Assert
      expect(result, isA<SecureStorageTokenProvider>());
    });

    test('should return the memory provider when isWeb is true', () {
      // Arrange
      const isWeb = true;

      // Act
      final result = buildTokenProvider(isWeb: isWeb);

      // Assert
      expect(result, isA<MemoryTokenProvider>());
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

    group('TokenProviderType', () {
      test('should resolve the secure storage provider when the host is not web', () {
        // Arrange
        // kIsWeb is false under flutter test

        // Act
        final result = getIt<TokenProviderType>();

        // Assert
        expect(result, isA<SecureStorageTokenProvider>());
      });
    });

    group('BaseUrlProviderType', () {
      test('should resolve the same object as the store when the provider is resolved', () {
        // Arrange
        final store = getIt<BaseUrlStoreType>();

        // Act
        final provider = getIt<BaseUrlProviderType>();

        // Assert
        expect(identical(store, provider), isTrue);
      });

      test('should read the stored value when the config asks for the base URL', () async {
        // Arrange
        await getIt<BaseUrlStoreType>().save('http://127.0.0.1:31415');

        // Act
        final result = await getIt<ApiConfig>().baseUrl();

        // Assert
        expect(result, 'http://127.0.0.1:31415');
      });

      test('should serve the new value through the same client when the store changes', () async {
        // Arrange
        final client = getIt<KanthordApi>();
        await getIt<BaseUrlStoreType>().save('http://127.0.0.1:31415');
        final first = await getIt<ApiConfig>().baseUrl();

        // Act
        await getIt<BaseUrlStoreType>().save('http://localhost:31415');
        final second = await getIt<ApiConfig>().baseUrl();

        // Assert
        expect(first, 'http://127.0.0.1:31415');
        expect(second, 'http://localhost:31415');
        expect(identical(client, getIt<KanthordApi>()), isTrue);
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 003.2 creates the seam.

### Task 003.2 — the injection root and the entry point

**Input:** `lib/app/theme_mode_controller.dart`, `lib/app/injection.dart`, `lib/main.dart`

**Action — GREEN:** write the three files exactly as the `## Change` section states. `lib/main.dart`
is a full replacement of the current seven lines.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/injection_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- `NEEDS-HUMAN:` that `kIsWeb` is true in a Chrome build. `buildTokenProvider(isWeb: true)` is
  proved headless; the value `kIsWeb` takes in the real web target is not. `make dev` is the check.
- Proof: `PASS 002-G1-DI`.
