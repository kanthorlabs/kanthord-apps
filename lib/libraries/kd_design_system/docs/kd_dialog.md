# KDDialog

## Overview

`KDDialog` is the surface above a page. It renders a full screen for `KDLayoutFamily.mobile` and a
centered dialog above it.

**It is not a page layout.** It sits above `KDFullScreenLayout` or `KDShellLayout` and neither one
knows about it. Read the page layout section of `../../../../DESIGNS.md`.

Three surfaces in this product need it:

| Surface                                                  | Size       | Source                                |
| -------------------------------------------------------- | ---------- | ------------------------------------- |
| A node action: unblock, approve, abandon, waive, discard | `standard` | `../../../../docs/api/operations.md`  |
| A host-key mismatch, showing both fingerprints           | `standard` | `../../../../docs/api/errors.md`      |
| A blob: a prompt, a diff, a check log                    | `large`    | `../../../../docs/api/conventions.md` |
| The plan import: validate, choose, import                | `large`    | `../../../../docs/api/operations.md`  |

It wraps the Flutter Material 3 `Dialog`, `Scaffold`, `AppBar`, and `showDialog`.

## Component anatomy

| Element | Type                     | Family     | Purpose                                |
| ------- | ------------------------ | ---------- | -------------------------------------- |
| Shell   | `Scaffold` or `Dialog`   | both       | The surface and its inset              |
| Title   | `KDText`, `titleLarge`   | both       | What the dialog asks or shows          |
| Close   | `KDButton.icon`          | both       | Leading on `mobile`, trailing above it |
| Content | `Widget`, scrolling      | both       | The body                               |
| Rule    | `Divider` of 1 px        | split only | Separates the title and the actions    |
| Actions | `Wrap`, trailing aligned | both       | The controls, pinned to the bottom     |

The content always scrolls. The title and the actions never do.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

final confirmed = await KDDialog.show<bool>(
  context,
  isDismissible: false,
  builder: (context) => KDDialog(
    title: 'Approve this node?',
    onClose: () => Navigator.of(context).pop(false),
    actions: [
      KDButton(
        label: 'Cancel',
        variant: KDButtonVariant.text,
        onPressed: () => Navigator.of(context).pop(false),
      ),
      KDButton(label: 'Approve', onPressed: () => Navigator.of(context).pop(true)),
    ],
    child: const KDText('The daemon records the approval against your configured actor.'),
  ),
);
```

Use `KDDialog.show`, never a bare `showDialog`. It pins `useSafeArea` to `false`, and without that
the family resolves from the inset box rather than from the screen.

## Properties

| Property  | Type            | Default    | Purpose                                |
| --------- | --------------- | ---------- | -------------------------------------- |
| `title`   | `String`        | required   | What the dialog asks or shows          |
| `child`   | `Widget`        | required   | The body, inside a scroll view         |
| `actions` | `List<Widget>`  | `[]`       | The controls, usually `KDButton`       |
| `onClose` | `VoidCallback?` | `null`     | The close control. `null` renders none |
| `size`    | `KDDialogSize`  | `standard` | The width cap in the dialog form       |

`onClose` reports to the caller and pops nothing itself. The design system runs no navigation, so
the app layer decides what closing means and what value it returns. A dialog whose only exit is a
choice passes `null` and pairs it with `isDismissible: false`.

## Methods

### `KDDialog.show<T>`

| Parameter       | Type            | Default  | Purpose                             |
| --------------- | --------------- | -------- | ----------------------------------- |
| `context`       | `BuildContext`  | required | The context that owns the navigator |
| `builder`       | `WidgetBuilder` | required | Builds the `KDDialog`               |
| `isDismissible` | `bool`          | `true`   | A barrier tap closes the dialog     |

It returns `Future<T?>`, which completes with the value the app layer pops.

## Related classes

### `KDDialogSize`

| Value      | Width cap                      | Used for                                    |
| ---------- | ------------------------------ | ------------------------------------------- |
| `standard` | `sizing.contentMaxWidth`, 480  | A confirmation and a fingerprint comparison |
| `large`    | `sizing.dialogLargeWidth`, 800 | A blob viewer and the plan import           |

The cap applies to the dialog form only. The `mobile` form always fills the screen.

## Technical notes

- `KDDialog` wraps itself in `KDLayout`, so it measures the width the route gives it. With
  `useSafeArea: false` that is the whole screen, which is the right input: the choice between a full
  screen and a centered box is a question about the device, not about the dialog.
- The `mobile` form is a real `Scaffold`, so it handles the status bar inset and the keyboard inset
  itself. The dialog form takes `insetPadding` of `spacing.xxl` instead.
- The dialog form is a `Column` with `mainAxisSize.min` and a `Flexible` content, so a short body
  makes a short dialog and a long body scrolls inside a dialog capped by the screen height.
- The actions sit in a `Wrap`, so two buttons stack rather than overflow on a narrow screen.
- `KDTokens.sizing.dialogLargeWidth` is `800`. A diff and a rendered prompt are wide, and 800 fits about 100
  columns of the default monospace measure. The value is a placeholder and carries
  `// TODO(tokens)`.
