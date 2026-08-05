# Operations

Commands, platform specifics, lints, and formatting. `CLAUDE.md` references this document.

## Toolchain

Flutter is pinned to **3.44.8** in `.fvmrc`. Use `fvm` so every contributor compiles with the same
SDK. Node is pinned in `.nvmrc` and is needed only for the commit hooks.

## There is no CI

This repository has no continuous integration. It is deferred until the MVP lands. Read `HANDOFF.md`
for what CI must do when it returns.

**Every check is local and manual.** Nothing stops an unformatted, failing, or non-compiling change
from reaching `main`. Before you push, run all three:

```
make format-check
make analyze
make test
```

## Commands

Run every command through `make`. The `Makefile` detects `fvm` and the host, so a Make target uses
the pinned Flutter and a bare `flutter` call may not.

| Command | Purpose |
|---|---|
| `make bootstrap` | Install the pinned Flutter through `fvm install`, then the Dart packages, then the commit hooks |
| `make generate` | Run `build_runner` one time |
| `make format` | Rewrite every Dart file |
| `make format-check` | Fail on an unformatted file. Run it before you push |
| `make analyze` | Run the static analyzer |
| `make test` | Run the test suite |
| `make clean` | Delete the build output and the generated files |
| `make run-ios` `make run-android` `make run-macos` `make run-windows` `make run-linux` `make run-web` | Run on one platform |
| `make help` | List every target |

The `Makefile` works on macOS, Windows, and Linux. No target other than `bootstrap` calls a
host-specific package manager.

### `make bootstrap` does not always install Flutter

When `fvm` is missing, `bootstrap` prints the install command for the detected host and exits
non-zero. **It installs no SDK in that case.** Install `fvm`, then run it again.

When `node` is missing, `bootstrap` prints a skip message and continues. Commit linting stays
optional, so a contributor without Node is never blocked.

## Building

`flutter build` alone is not a command. Each target needs its own subcommand, and a host builds only
the targets it supports.

| Target | Subcommand | Host |
|---|---|---|
| macOS | `flutter build macos` | macOS |
| iOS | `flutter build ios` | macOS |
| Android | `flutter build apk` | macOS, Linux, Windows |
| web | `flutter build web` | any |
| Linux | `flutter build linux` | Linux |
| Windows | `flutter build windows` | Windows |

A Mac host verifies macOS, iOS, Android, and web locally.

**Windows and Linux are unverified.** Neither has ever been compiled. With CI removed there is no
machine that builds them, so a change that breaks either target stays hidden until somebody builds it
by hand. Treat both as declared but untested.

Six declared platforms need six compile checks. Until CI returns, that check does not exist.

## Platform files carry hand-written changes

These files were edited by hand after `flutter create`. They are **not** reproducible by
regenerating the platform folder:

| File | Change |
|---|---|
| `macos/Runner/MainFlutterWindow.swift` | `contentMinSize` 480 by 640 |
| `windows/runner/win32_window.cpp` | `WM_GETMINMAXINFO` clamp, DPI scaled |
| `linux/runner/my_application.cc` | `GDK_HINT_MIN_SIZE`, window title, header-bar title |
| `macos/Runner/Configs/AppInfo.xcconfig` | `PRODUCT_NAME` |
| `ios/Runner/Info.plist` | `CFBundleDisplayName` |
| `android/app/src/main/AndroidManifest.xml` | `android:label` |
| `windows/runner/main.cpp`, `windows/runner/Runner.rc` | window title, product name |
| `web/index.html`, `web/manifest.json` | title, name, short name |

**Never run `flutter create` with `--overwrite` in this repository.** After any command that
regenerates a platform folder, read the diff for these files and restore what it dropped.

The minimum window size of 480 by 640 logical pixels exists so a desktop window can reach the
`mobile` layout family but never go below what it supports. No package provides it. It is native
code in three files.

## The API base URL is per target

`http://localhost:31415` names the device the code runs on, not the development machine. It is not
one constant. `ApiConfig` resolves the host per target:

| Target | Host |
|---|---|
| macOS, Windows, Linux, web on the dev machine | `localhost` |
| iOS simulator | `localhost` |
| Android emulator | `10.0.2.2` |
| A physical device | the development machine LAN IP. Ask the owner for it |

Two transport limits follow from `http://`:

- A web build served over HTTPS cannot call an `http://` URL. The browser blocks mixed content. Keep
  the web development build on plain HTTP. Ask the owner for the HTTPS URL before you build a
  production web bundle.
- Android and iOS restrict cleartext HTTP. A release build against an `http://` host needs a platform
  exception, which this repository does not add.

For a web client, the server must send CORS headers for the client origin and must expose the SSE
content type. Any proxy in front of the server must have response buffering off. A buffering proxy
makes an SSE stream arrive as one block at the end.

## Lints and formatting

`analysis_options.yaml` is the authority. Read it rather than a copy of its values. Three settings
you need before you write a line:

- The formatter page width is **100**. `dart format` enforces it, and `make format-check` fails on
  any difference.
- `strict-casts` and `strict-raw-types` are on. `strict-inference` is off. An implicit downcast and a
  raw generic are both analyzer errors.
- The base lint set is `package:flutter_lints/flutter.yaml`.

Generated files (`*.g.dart`, `*.freezed.dart`, `*.mocks.dart`, `*.gen.dart`) and `build/` are
excluded from analysis. `test/**` is analyzed, so test code passes the same lints.

`format` rewrites files and `format-check` does not. When CI returns it must call `format-check`
only, because a job that rewrites files hides the very difference it should report.

## Code generation

`build.yaml` scopes each builder to the paths it owns:

| Builder | Generates for |
|---|---|
| `freezed` | `lib/api/models/**`, `lib/features/**_state.dart` |
| `json_serializable` | `lib/api/models/**`, with `field_rename: snake` |
| `go_router_builder` | `lib/features/**_routes.dart` |
| `envied_generator` | `lib/app/env/**` |
| `mockito` | `test/**` |

Several of those paths do not exist yet, so `make generate` currently writes no output. That is
correct for the current tree, not a broken configuration.

`pubspec.lock` and every generated file are **committed**, so a fresh clone analyzes and tests
without running codegen first. Run `make generate` and commit the result whenever you change a model,
a state class, or a route.

## Dependencies

Pin every dependency to a caret range on a stable version. Add no dependency without the owner's
approval. Prefer the Flutter SDK and `dart:` libraries.

`freezed` is pinned to `^3.2.5` and `mockito` to `^5.6.4`. Both are stable. `freezed` stable requires
`analyzer <11 or ^12`, and `mockito >=5.7.0` requires `analyzer >=13`. They cannot both be newest.
Stable wins. Revisit when `freezed` 4 reaches stable.

Run `flutter pub outdated` after a dependency change and read the result.

## Secrets

`envied` obfuscates a constant. It does not hide it. A web build ships readable JavaScript, so any
value in the bundle is public.

**Put no server secret in the client.** Use `envied` for the base URL and for public identifiers
only.

Never write a refresh token to `shared_preferences` and never to `localStorage`. Token storage is
`flutter_secure_storage` on native and memory only on web.
