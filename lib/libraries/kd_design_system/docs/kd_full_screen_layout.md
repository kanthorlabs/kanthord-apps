# KDFullScreenLayout

## Overview

`KDFullScreenLayout` is the first of the two page layouts. It gives one centered column and **no
navigation**, because it renders the states where no destination is reachable.

Use it for exactly three surfaces:

| Surface              | Why it has no navigation                                        |
| -------------------- | --------------------------------------------------------------- |
| Daemon connect       | The base URL and the token are not set, so no read screen works |
| Unauthorized         | A `401`. Every route needs the token, `system.health` included  |
| Boot and unreachable | The client has no daemon to talk to yet                         |

Read `../../../../docs/api/auth.md` for the provisioning flow these three serve.

**Do not use it for a failure the shell survives.** A `501` from one destination, an empty list, and
a failed reload all keep the top bar and the navigation up. They render `KDStatusView` in the content
region of `KDShellLayout` instead.

It wraps the Flutter Material 3 `Scaffold`, plus `SafeArea`, `Center`, and `SingleChildScrollView`.

## Component anatomy

| Element | Type               | Purpose                                                    |
| ------- | ------------------ | ---------------------------------------------------------- |
| Shell   | `Scaffold`         | The surface color and the safe area                        |
| Brand   | `KDBrand`, `large` | Optional. The product signature above the content          |
| Content | `Widget`           | The form, the message, or the `KDStatusView`               |
| Footer  | `Widget?`          | Optional. A note under the content, such as a version line |

The column centers on both axes and caps at `maxContentWidth`.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDFullScreenLayout(
  child: Column(
    children: [
      KDInputField(label: 'Base URL', value: state.baseUrl, onChanged: bloc.baseUrlChanged),
      KDButton(label: 'Connect', isBusy: state.isProbing, onPressed: bloc.connect),
    ],
  ),
);

const KDFullScreenLayout(
  child: KDStatusView(kind: KDStatusKind.loading, title: 'Reaching the daemon'),
);
```

## Properties

| Property          | Type      | Default  | Purpose                             |
| ----------------- | --------- | -------- | ----------------------------------- |
| `child`           | `Widget`  | required | The content of the column           |
| `showBrand`       | `bool`    | `true`   | Renders `KDBrand` above the content |
| `footer`          | `Widget?` | `null`   | A note under the content            |
| `maxContentWidth` | `double?` | `null`   | Overrides `sizing.contentMaxWidth`  |

## Methods

`KDFullScreenLayout` exposes no method.

## Related classes

None. The layout composes `KDBrand` and takes every other part as a slot.

## Technical notes

- The layout wraps itself in `KDLayout`, so a descendant reads `context.kdLayout` without an
  ancestor of its own.
- It branches on no layout family. The width cap is `KDTokens.sizing.contentMaxWidth`, which is `480`, and a
  narrower window simply gets its own width. A branch would add a fork and change nothing.
- `Center` above `SingleChildScrollView` centers short content and scrolls tall content. A small
  window height therefore scrolls rather than overflows.
- The layout renders no app bar and no navigation. That absence is the point of the component. Do not
  add a slot for either.
