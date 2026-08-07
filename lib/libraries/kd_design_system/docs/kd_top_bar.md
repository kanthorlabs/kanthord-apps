# KDTopBar

## Overview

`KDTopBar` is the top edge of `KDShellLayout`. It carries the brand, the page title, the daemon
connection state, and the page actions. Every product destination shows it.

It wraps the Flutter Material 3 `AppBar`, `Chip`, `ActionChip`, and `IconButton`.

**The daemon has no user model.** `../../../../docs/api/auth.md` states it: no sign-in, no refresh,
no token lifetime, one static bearer token for one human. So the trailing edge holds a connection
state and a settings entry, never an account. Do not add an avatar and do not add an actor picker.

Design link: the ELSA Design System page defines the method. See `../README.md` for the tokens.

## Component anatomy

| Element | Type                    | Purpose                                              |
| ------- | ----------------------- | ---------------------------------------------------- |
| Shell   | `AppBar`                | The top edge, one `kToolbarHeight` tall              |
| Leading | `Widget?`               | The start-edge slot. `KDShellLayout` leaves it empty |
| Brand   | `KDBrand`, `small`      | The mark, plus the wordmark above `mobile`           |
| Title   | `KDText`, `titleMedium` | The page name, one line, ellipsized                  |
| Status  | `Chip` or `ActionChip`  | The daemon connection state                          |
| Actions | `List<Widget>`          | The page actions, at the trailing edge               |

The status renders an icon only on `mobile` and an icon plus a label above it. It becomes an
`ActionChip` when `onStatusPressed` is set and a `Chip` when it is not, so a state with no menu never
looks disabled.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDTopBar(
  title: 'Nodes',
  status: KDConnectionStatus.degraded,
  statusDetail: 'git reports failed',
  onStatusPressed: openDaemonSettings,
  actions: [
    KDButton.icon(icon: Icons.refresh, tooltip: 'Reload the list', onPressed: reload),
  ],
);
```

`KDShellLayout` builds the bar for you. Construct `KDTopBar` directly only outside the shell.

## Properties

| Property          | Type                  | Default | Purpose                                         |
| ----------------- | --------------------- | ------- | ----------------------------------------------- |
| `title`           | `String?`             | `null`  | The page name next to the brand                 |
| `leading`         | `Widget?`             | `null`  | The start-edge control                          |
| `actions`         | `List<Widget>`        | `[]`    | The trailing controls, before the status        |
| `status`          | `KDConnectionStatus?` | `null`  | The daemon state. `null` hides the indicator    |
| `statusDetail`    | `String?`             | `null`  | The tooltip text. Falls back to the state label |
| `onStatusPressed` | `VoidCallback?`       | `null`  | Opens the daemon settings                       |

`preferredSize` is `kToolbarHeight`. `Scaffold` adds the status-bar padding itself, so the bar must
not add it again.

## Methods

`KDTopBar` exposes no method. Change the state by rebuilding with a new `status`.

## Related classes

### `KDConnectionStatus`

The five outcomes of the `GET /v1/health` probe in `../../../../docs/api/auth.md`, plus the state
while the probe runs.

| Value          | Label          | Color role         | Means                                           |
| -------------- | -------------- | ------------------ | ----------------------------------------------- |
| `connecting`   | `Connecting`   | `onSurfaceVariant` | The probe is in flight. Renders a spinner       |
| `connected`    | `Connected`    | `primary`          | `200`. The URL, the host list and the token     |
| `degraded`     | `Degraded`     | `tertiary`         | `200`, and the body reports a failed dependency |
| `unauthorized` | `Unauthorized` | `error`            | `401`. The token is wrong                       |
| `unreachable`  | `Unreachable`  | `error`            | A connection failure. The URL is wrong          |

`degraded` comes from the response **body**, never from the HTTP status. `system.health` answers
`200` with `"status": "degraded"`. Read `../../../../docs/api/operations.md`.

`403 origin-forbidden` maps to `unreachable`, because a browser cannot tell a rejected origin from a
dead daemon. Read `../../../../docs/api/connectivity.md`.

## Technical notes

- `KDTopBar` wraps itself in `KDLayout`, so it measures the width it receives and needs no `KDLayout`
  ancestor. The wordmark and the status label appear above `mobile`.
- The status colors are placeholders. Material 3 `ColorScheme` defines no success role and no warning
  role, so `primary` stands in for healthy and `tertiary` stands in for degraded. Replace both when
  the design file supplies a semantic status palette. The source carries `// TODO(tokens)`.
- Every action sits inside a `Center`, because `AppBar` stretches its actions row to the full toolbar
  height and a stretched chip loses its shape.
- The status indicator always carries a tooltip, so the icon-only form on `mobile` stays readable.
