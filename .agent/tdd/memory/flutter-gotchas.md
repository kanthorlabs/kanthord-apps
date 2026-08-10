# Flutter and Dart gotchas

Read the section that covers the area you are about to touch. Do not read the file upfront.

Every entry here is a trap that costs a turn. Add an entry when one costs you a turn. Append only.

## Code generation

- Four builders run over `lib/`: `freezed`, `json_serializable`, `go_router_builder`, `envied`. One
  builder runs over `test/`: `mockito`. Read `build.yaml` for the exact path filter per builder.
- A `@freezed` class needs `part '<file>.freezed.dart';`. A `@JsonSerializable` class needs
  `part '<file>.g.dart';` as well. Write the `part` line in the same edit as the annotation, or
  `flutter analyze` reports `uri_has_not_been_generated` and stops resolving the file.
- `make generate-lib` is the software-engineer lane. `make generate-test` is the test-engineer lane.
  **Never run bare `make generate`** — it rewrites the other role's generated files and the lane
  guard rejects the turn.
- A `.mocks.dart` file depends on **both** the `@GenerateMocks` annotation and the production API it
  mocks. The software-engineer changes the API; the test-engineer regenerates the mock on its next
  turn. The software-engineer never regenerates it.
- `analysis_options.yaml` excludes `*.g.dart`, `*.freezed.dart`, `*.mocks.dart` and `*.gen.dart`.
  So `flutter analyze` says nothing about a generated file itself. A stale generated file surfaces
  as an error in the **hand-written** file that uses it, or not at all until `flutter test` compiles.
- Generated files are committed. Read `CLAUDE.md`, "Repository state".

## Analysis

- `flutter analyze` covers `test/` under the same lints as `lib/`. Test code is not exempt.
- `strict-casts: true` and `strict-raw-types: true` are on. An implicit downcast and a bare `List`
  are both errors, not hints.
- An unresolved import makes every symbol it provided undefined, so one missing seam produces a
  flood of errors, not one. Read the **first** error; the rest are its consequence.
- `flutter analyze lib` scopes the run to the production tree. That is the software-engineer gate.

## Widget tests

- `pumpAndSettle` never returns when an indeterminate animation runs — a `CircularProgressIndicator`
  in a loading state is the usual cause. Pump an explicit duration instead: `await tester.pump()`
  then `await tester.pump(const Duration(milliseconds: 100))`.
- Set the surface size with `tester.view.physicalSize` and `tester.view.devicePixelRatio`, and reset
  both with `addTearDown(tester.view.reset)`. A leaked size breaks the next test in the file.
- The three layout families switch on width. Read `DESIGNS.md` for the breakpoints, and drive a
  breakpoint test from the boundary value, not from a value near it.
- `find.text` matches the rendered string. A `KDText` that formats its input needs the formatted
  string in the matcher, not the raw one.

## The web target

- `dart:io` does not exist on web. Anything under `lib/api/` and `lib/features/` that imports it
  breaks the web build, and `flutter analyze` does **not** catch it — only `flutter build web` does.
- Token storage differs by platform: `flutter_secure_storage` on native, memory on web. Read
  `CLAUDE.md`, "Stack". Select the implementation with a conditional import, never with a runtime
  `kIsWeb` branch inside the SDK.
- `Platform.pathSeparator` and `Directory.current` do not exist on web either.

## Dependency injection

- `KanthordApi` is registered **one time** in `get_it` as a lazy singleton. A route does not register
  it; the route reads `getIt<KanthordApi>()` and passes it to the bloc constructor. Read `CLAUDE.md`,
  "The SDK" and "A feature".
- `get_it` throws at resolve time, not at compile time. A missing registration is a runtime failure
  in a test that builds the route.

## Test isolation

- `flutter test` runs each test file in its own isolate, and the files run concurrently. A test that
  writes a fixed path collides with itself. Use a temp directory per test and delete it in
  `addTearDown`.
- The mock daemon binds `127.0.0.1:0` and reports its port. A fixed port collides. Read
  `docs/api/parallel-development.md`.
