# Operations

Commands, platform specifics, lints, and formatting. `CLAUDE.md` references this document.

## Toolchain

Flutter is pinned to **3.44.8** in `.fvmrc`. Use `fvm` so every contributor compiles with the same
SDK. Node is pinned in `.nvmrc` and is needed for the commit hooks and for the prettier half of
`make format`. Neither blocks a contributor without it.

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

| Command                                                                                               | Purpose                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `make bootstrap`                                                                                      | Install the pinned Flutter through `fvm install`, then the Dart packages, then the commit hooks |
| `make generate`                                                                                       | Run `build_runner` one time                                                                     |
| `make format`                                                                                         | Rewrite every Dart, Markdown, YAML and JSON file                                                |
| `make format-check`                                                                                   | Fail on an unformatted file. Run it before you push                                             |
| `make analyze`                                                                                        | Run the static analyzer                                                                         |
| `make test`                                                                                           | Run the test suite                                                                              |
| `make clean`                                                                                          | Delete the build output and the generated files                                                 |
| `make run-ios` `make run-android` `make run-macos` `make run-windows` `make run-linux` `make run-web` | Run on one platform                                                                             |
| `make help`                                                                                           | List every target                                                                               |

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

| Target  | Subcommand              | Host                  |
| ------- | ----------------------- | --------------------- |
| macOS   | `flutter build macos`   | macOS                 |
| iOS     | `flutter build ios`     | macOS                 |
| Android | `flutter build apk`     | macOS, Linux, Windows |
| web     | `flutter build web`     | any                   |
| Linux   | `flutter build linux`   | Linux                 |
| Windows | `flutter build windows` | Windows               |

A Mac host verifies macOS, iOS, Android, and web locally.

**Windows and Linux are unverified.** Neither has ever been compiled. With CI removed there is no
machine that builds them, so a change that breaks either target stays hidden until somebody builds it
by hand. Treat both as declared but untested.

Six declared platforms need six compile checks. Until CI returns, that check does not exist.

## Platform files carry hand-written changes

These files were edited by hand after `flutter create`. They are **not** reproducible by
regenerating the platform folder:

| File                                                  | Change                                              |
| ----------------------------------------------------- | --------------------------------------------------- |
| `macos/Runner/MainFlutterWindow.swift`                | `contentMinSize` 480 by 640                         |
| `windows/runner/win32_window.cpp`                     | `WM_GETMINMAXINFO` clamp, DPI scaled                |
| `linux/runner/my_application.cc`                      | `GDK_HINT_MIN_SIZE`, window title, header-bar title |
| `macos/Runner/Configs/AppInfo.xcconfig`               | `PRODUCT_NAME`                                      |
| `ios/Runner/Info.plist`                               | `CFBundleDisplayName`                               |
| `android/app/src/main/AndroidManifest.xml`            | `android:label`                                     |
| `windows/runner/main.cpp`, `windows/runner/Runner.rc` | window title, product name                          |
| `web/index.html`, `web/manifest.json`                 | title, name, short name                             |

**Never run `flutter create` with `--overwrite` in this repository.** After any command that
regenerates a platform folder, read the diff for these files and restore what it dropped.

The minimum window size of 480 by 640 logical pixels exists so a desktop window can reach the
`mobile` layout family but never go below what it supports. No package provides it. It is native
code in three files.

## The API base URL

**`docs/api/connectivity.md` is the authority. Read it rather than a copy of its values.** It holds the
per-target host table, the daemon configuration keys, the platform traps and the browser rules. Four
facts from it that change how you run the app:

- **There is no default port and no default base URL.** The daemon requires `KANTHORD_HTTP_PORT` and has
  no default, so the human enters the base URL per install. `http://localhost:31415` appeared in an
  earlier draft and that port was invented.
- **`localhost` is the device.** A physical phone needs the development machine's LAN address, and the
  daemon must bind a non-loopback address to answer it. The Android emulator uses `10.0.2.2`.
- **Web needs the daemon to list the page origin.** Run the web build on a pinned port —
  `flutter run -d chrome --web-port=8080` — and set `KANTHORD_HTTP_ALLOWED_ORIGINS` on the daemon to
  match. An unlisted origin is `403 origin-forbidden`, and in a browser that failure is
  indistinguishable from the daemon being down.
- **Cleartext HTTP needs a platform exception** on Android and iOS, scoped to the configured host. This
  repository does not add it yet.

An HTTPS production web bundle cannot call a plain-HTTP daemon directly. It goes through a reverse proxy
that serves the bundle and forwards a same-origin path. There is no SSE and no streaming, so no proxy
buffering rule applies — the client long-polls. Read `docs/api/polling.md`.

## Lints and formatting

Two formatters, one command. `make format` runs both, and `make format-check` fails on either.

| Files                         | Formatter                                         | Config                                  |
| ----------------------------- | ------------------------------------------------- | --------------------------------------- |
| `*.dart`                      | `dart format`, through `fvm` when it is installed | `analysis_options.yaml`, page width 100 |
| `*.{md,json,yml,yaml,mjs,js}` | `prettier`                                        | `.prettierrc.json`, print width 100     |

`.prettierignore` holds what prettier must not touch. Three entries earn their place: `pubspec.yaml`,
because the Flutter tooling owns it; `docs/api/contract/`, because the engine generates it
canonically and `publish-contract.ts` overwrites it on every refresh; and every platform
directory, because their files are generated.

**A `pre-commit` hook runs both on staged files**, through `husky` plus `lint-staged`.
`lint-staged.config.mjs` resolves `fvm dart` when `fvm` is present and plain `dart` otherwise, so the
hook and the `Makefile` format with the same SDK. A different SDK gives a hook that reformats what
`format-check` then rejects.

Prettier needs Node, and it follows the same policy as commit linting: `make bootstrap` prints a skip
message without Node, and `make format` and `make format-check` skip the prettier half and say so. The
Dart half always runs.

`analysis_options.yaml` remains the authority for Dart. Read it rather than a copy of its values. Three
settings you need before you write a line:

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

| Builder             | Generates for                                     |
| ------------------- | ------------------------------------------------- |
| `freezed`           | `lib/api/models/**`, `lib/features/**_state.dart` |
| `json_serializable` | `lib/api/models/**`, with `field_rename: snake`   |
| `go_router_builder` | `lib/features/**_routes.dart`                     |
| `envied_generator`  | `lib/app/env/**`                                  |
| `mockito`           | `test/**`                                         |

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
