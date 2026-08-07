# KDSideBar

## Overview

`KDSideBar` is the permanent navigation region of `KDShellLayout` on a desktop window. It groups the
destinations into labelled sections and keeps every label visible.

It wraps the Flutter Material 3 `NavigationDrawer`, `NavigationDrawerDestination`, and `DrawerTheme`.

`KDAdaptiveScaffold` renders it for `KDLayoutFamily.expanded` only. Below `840` the rail and the
bottom bar carry navigation instead. Read `../README.md` for the three families.

## Component anatomy

| Element       | Type                          | Purpose                                       |
| ------------- | ----------------------------- | --------------------------------------------- |
| Shell         | `NavigationDrawer`            | The scrolling destination column              |
| Header        | `Widget?`                     | Pinned above the destinations                 |
| Section label | `KDText`, `labelLarge`        | Names one group. A section may carry no label |
| Destination   | `NavigationDrawerDestination` | One navigation target, icon plus label        |
| Section rule  | `Divider`                     | Separates two sections                        |
| Footer        | `Widget?`                     | Pinned below the destinations                 |

The header and the footer do not scroll. The destinations do.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDSideBar(
  sections: const [
    KDSideBarSection(
      label: 'Plan',
      destinations: [
        KDDestination(label: 'Projects', icon: Icons.folder_outlined, selectedIcon: Icons.folder),
        KDDestination(label: 'Nodes', icon: Icons.account_tree_outlined, selectedIcon: Icons.account_tree),
      ],
    ),
    KDSideBarSection(
      label: 'System',
      destinations: [
        KDDestination(label: 'Activity', icon: Icons.history_outlined, selectedIcon: Icons.history),
      ],
    ),
  ],
  selectedIndex: index,
  onDestinationSelected: (next) => setState(() => index = next),
);
```

`KDShellLayout` builds the sidebar for you. Construct `KDSideBar` directly only outside the shell.

## Properties

| Property                | Type                     | Default  | Purpose                          |
| ----------------------- | ------------------------ | -------- | -------------------------------- |
| `sections`              | `List<KDSideBarSection>` | required | The destination groups, in order |
| `selectedIndex`         | `int`                    | required | The active destination           |
| `onDestinationSelected` | `ValueChanged<int>`      | required | Fires with the tapped index      |
| `header`                | `Widget?`                | `null`   | Pinned above the destinations    |
| `footer`                | `Widget?`                | `null`   | Pinned below the destinations    |
| `width`                 | `double?`                | `null`   | Overrides `sizing.sideBarWidth`  |

**`selectedIndex` is flat and it counts destinations only.** It runs across every section and it
skips the labels and the rules. A section label is not selectable, so the second destination of the
first section is index `1` whatever sits above it.

The selected index is a property, not internal state. The parent owns it.

## Methods

`KDSideBar` exposes no method. Change the destination by rebuilding with a new `selectedIndex`.

## Related classes

### `KDSideBarSection`

An immutable value class that names one group of destinations.

| Property       | Type                  | Purpose                                 |
| -------------- | --------------------- | --------------------------------------- |
| `label`        | `String?`             | The group name. `null` renders no label |
| `destinations` | `List<KDDestination>` | The targets of the group, in order      |

### `KDDestination`

Shared with `KDAdaptiveScaffold` and `KDShellLayout`. It lives in `layout/kd_destination.dart`, so
the bottom bar, the rail, and the sidebar all read one description of a target.

## Technical notes

- `KDTokens.sizing.sideBarWidth` is `280`. The Material default `Drawer` width is `304` and it is tuned for a modal
  drawer, not for a permanent region beside content. The value is a placeholder and it carries
  `// TODO(tokens)`.
- The width and the shape come from a `DrawerTheme` wrapper rather than from a `SizedBox`, because
  `NavigationDrawer` builds its own `Drawer` and reads both from the theme.
- The shape is a square `RoundedRectangleBorder`. The Material 3 default rounds the trailing edge by
  `16`, which is correct for a modal drawer and wrong for a region that abuts content.
- `NavigationDrawer` assigns its selection index to `NavigationDrawerDestination` children only and
  it skips every other child. The flat index rule above follows from that, and a section label
  therefore costs no index.
- A section rule renders between two sections and never after the last one.
