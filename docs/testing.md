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

### The event poller

Nothing streams, so there is no framing parser to test. Read `docs/api/polling.md` for the protocol
and `docs/api/parallel-development.md` for the mock daemon the poller runs against.

| Case                                       | What it proves                                                   |
| ------------------------------------------ | ---------------------------------------------------------------- |
| A page of events followed by an empty page | The cursor advances once per accepted page and then holds        |
| A handler future that has not completed    | The poller issues no further request. Backpressure holds         |
| A handler that throws                      | The poller stops and the cursor never passes the failed page     |
| A restart with a stored cursor             | Delivery resumes after the last accepted event, never before it  |
| A null cursor                              | The log is drained from the beginning through the same handler   |
| An empty `200` after the wait elapses      | A quiet daemon is not an error and does not reset the cursor     |
| A dropped connection mid-poll              | The poller backs off and retries; it delivers no duplicate event |
| A cancelled poller                         | The loop stops and issues no further request                     |
| Two pages where the second repeats an id   | A duplicate is dropped, because delivery is at-least-once        |

The four failure classes in `docs/api/polling.md` are distinct states, not one error. Assert that an
unreachable daemon, an unauthorized poll, a quiet daemon and a cancelled poller are told apart on
`PollerStatus`, never on a message string.

The poller delivers through an acknowledged handler, not a `Stream`. Read the delivery section of
`docs/api/polling.md` before writing a poller test that awaits a stream event.

### The auth interceptor

**There is no refresh.** `docs/api/auth.md` deletes the sign-in, the refresh endpoint and the token
lifetime, so the concurrent-401 test this section once specified counts a call that no code makes.

Assert four things:

- The request carries `Authorization: Bearer <token>`.
- A null or empty token throws `ApiUnauthorizedException` **before** the request leaves.
- A `401` throws `ApiUnauthorizedException`, with no retry and no second request.
- The stored token **survives** a `401`. Only an explicit user action clears it.

### The retry interceptor

Read the retry table of `docs/api/errors.md`. The rule is by method **and** by idempotency key, not
by method alone.

- A `GET` is retried. A `PUT` and a `DELETE` are not.
- A `POST` with no `Idempotency-Key` is **never** retried, because the server may have processed it.
- A `POST` **with** an `Idempotency-Key` is retried, and every attempt carries the same key and the
  same body bytes. The daemon fingerprints the raw bytes, so a re-serialization that reorders a JSON
  object is `409 idempotency-mismatch`.
- A cancelled request is never retried.
- The backoff schedule is asserted with a seeded `Random` passed to the constructor.

## Testing the design system

Write a widget test for any component whose behavior changes with the layout family.

`KDAdaptiveScaffold` is the reference case. Set the surface size in each of the three width bands.
Assert bottom navigation, a navigation rail, and a `KDSideBar`, one per band.

Set the surface size like this, and always register the reset:

```dart
tester.view.devicePixelRatio = 1;
tester.view.physicalSize = size;
addTearDown(tester.view.reset);
```

Test every boundary value. `600` belongs to `wide` and `840` belongs to `expanded`, so assert `599`,
`600`, `839`, and `840`, never `500` and `700`.

Also assert that the family follows the **pane** width, not the window width: place the component in
a narrow `SizedBox` inside a wide surface and assert the `mobile` shell.

## Verification beyond tests

A passing suite is not a verified component. Read `DESIGNS.md` for the check every component needs:
the light theme and the dark theme, at the `mobile`, `wide`, and `expanded` widths.

Report no success for an unverified step. Name every target you did not build and say why.
