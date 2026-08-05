# Testing

Every testing rule for this repository. `CLAUDE.md` references this document.

Run the suite with `make test`. `test/**` is analyzed, so test code passes the same lints as `lib/`.
Read `docs/operations.md` for the lint settings.

## Layout

Mirror `lib/` under `test/`. A test for
`lib/libraries/kd_design_system/layout/kd_adaptive_scaffold.dart` lives at
`test/libraries/kd_design_system/layout/kd_adaptive_scaffold_test.dart`.

## Structure

- Name a test `'should <expected behavior> when <condition>'`.
- Group by class, then by method. Nest the method group inside the class group.
- Mark sections with `// Arrange`, `// Act`, `// Assert`. These three comments are the only comments
  allowed in a test.

```dart
void main() {
  group('KDAdaptiveScaffold', () {
    group('build', () {
      testWidgets('should render bottom navigation when the width is below 600', (tester) async {
        // Arrange
        const size = Size(599, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(find.byType(NavigationRail), findsNothing);
      });
    });
  });
}
```

## What to mock

- Mock `KanthordApi` in a bloc test.
- **Do not mock a repository.** None exists. Read `CLAUDE.md` for the no-Clean-Architecture rule.
- Do not mock a `KD` component. Render it.

## Testing the SDK

### A resource method

Test it with a `Dio` that uses a mock adapter. `KanthordApi` takes an optional `Dio` for exactly this
reason, so never construct `Dio` inside a resource class.

Assert three things per method: the request path, the request body, and the decoded model.

### The SSE parser

The wire format is stricter than it looks. Cover every one of these cases:

| Case | What it proves |
|---|---|
| A multiline `data:` | The values join with a newline, in order |
| A `\r\n` stream | All three line breaks are accepted: `\n`, `\r\n`, `\r` |
| A comment heartbeat | A line starting with `:` is skipped, not parsed |
| A multi-byte character split across two chunks | Decoding is incremental through a `StreamTransformer`, not `utf8.decode` per chunk |
| An unknown field name | It is ignored, and nothing throws |
| A stream that ends without a trailing blank line | The trailing partial event is discarded |

Also assert that a blank line dispatches the buffered event and that a field line alone dispatches
nothing.

### The auth interceptor

Fire **three concurrent 401s** and assert the refresh endpoint receives **exactly one** call. The
refresh is held in a single shared `Future`, so ten requests that get a 401 together await one
refresh and then all retry.

Assert that a second 401 with the same fresh token becomes the unauthorized exception rather than a
second refresh.

### The retry interceptor

Assert that a `POST` is **never** retried, because the server may have processed it.

Assert that a cancelled request is never retried.

## Testing the design system

Write a widget test for any component whose behavior changes with the layout family.

`KDAdaptiveScaffold` is the reference case. Set the surface size below `600` and at or above `600`.
Assert bottom navigation in one case and a navigation rail in the other.

Set the surface size like this, and always register the reset:

```dart
tester.view.devicePixelRatio = 1;
tester.view.physicalSize = size;
addTearDown(tester.view.reset);
```

Test the boundary value. `600` belongs to `wide`, so assert `599` and `600`, not `500` and `700`.

Also assert that the family follows the **pane** width, not the window width: place the component in
a narrow `SizedBox` inside a wide surface and assert the `mobile` shell.

## Verification beyond tests

A passing suite is not a verified component. Read `DESIGNS.md` for the four-way check every
component needs: light theme, dark theme, `mobile` layout, `wide` layout.

Report no success for an unverified step. Name every target you did not build and say why.
