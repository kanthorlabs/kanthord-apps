# KDStatusView

## Overview

`KDStatusView` renders the four states that are not content: loading, error, empty, and not
implemented. One component covers all four, so a wait and a failure never look like two products.

It renders inside either layout. `KDFullScreenLayout` takes it as the child for a boot state or a
connection failure. `KDShellLayout` takes it in the content region, where the top bar and the
navigation stay up and only the content region reports the state.

**Choose the host by what failed.** A daemon the client cannot reach is a full-screen state, because
no destination works. A `node.list` that answers `501` is a content-region state, because every other
destination still works. Do not tear down the shell for a failure the shell survives.

It wraps the Flutter Material 3 `CircularProgressIndicator`, `Icon`, and `Wrap`, plus `KDText`.

## Component anatomy

| Element | Type                                  | Purpose                                     |
| ------- | ------------------------------------- | ------------------------------------------- |
| Glyph   | `Icon` or `CircularProgressIndicator` | Names the state without reading             |
| Title   | `KDText`, `titleLarge`                | One line. What happened                     |
| Message | `KDText`, `bodyMedium`                | Optional. Why, and what the human does next |
| Actions | `Wrap` of `KDButton`                  | Optional. The recovery controls             |

Every element centers on both axes inside a column of at most `sizing.contentMaxWidth`.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

const KDStatusView(kind: KDStatusKind.loading, title: 'Reading the node list');

KDStatusView(
  kind: KDStatusKind.notImplemented,
  title: 'The daemon does not do this yet',
  message: 'node.list answers 501. It lands in daemon phase 1.',
);

KDStatusView(
  kind: KDStatusKind.error,
  title: 'The daemon is unreachable',
  message: 'Check the base URL and check that the daemon runs.',
  actions: [KDButton(label: 'Retry', onPressed: retry)],
);
```

## Properties

| Property  | Type           | Default  | Purpose                                       |
| --------- | -------------- | -------- | --------------------------------------------- |
| `kind`    | `KDStatusKind` | required | Selects the glyph and its color role          |
| `title`   | `String`       | required | One line. What happened                       |
| `message` | `String?`      | `null`   | Why it happened and what to do                |
| `actions` | `List<Widget>` | `[]`     | The recovery controls, usually one `KDButton` |

## Methods

`KDStatusView` exposes no method.

## Related classes

### `KDStatusKind`

| Value            | Glyph                         | Color role         | Used for                               |
| ---------------- | ----------------------------- | ------------------ | -------------------------------------- |
| `loading`        | `CircularProgressIndicator`   | `primary`          | A request in flight                    |
| `error`          | `Icons.error_outline`         | `error`            | A failure the human can act on         |
| `empty`          | `Icons.inbox_outlined`        | `onSurfaceVariant` | A successful read that returned no row |
| `notImplemented` | `Icons.construction_outlined` | `onSurfaceVariant` | A `501` from the daemon                |

**`notImplemented` is not an error and must never look like one.** 51 of the 53 daemon operations
answer `501 not-implemented` today, so this is the common state, not the exception. It reads in the
neutral color role. Read `../../../../docs/api/operations.md` and `../../../../docs/api/errors.md`.

`empty` and `notImplemented` share a color role and differ by glyph and by words. An empty list is a
fact about the data. A `501` is a fact about the daemon build.

## Technical notes

- The view centers and scrolls. A long message at a small window height scrolls rather than
  overflows.
- The column caps at `KDTokens.sizing.contentMaxWidth`, which is `480`, so a line stays readable on a 1600 px
  content region.
- The actions sit in a `Wrap`, so two buttons stack instead of overflowing at a narrow width.
- The component branches on no layout family. It reads the same in all three, and the cap does the
  work the branch would.
