# KDAdaptiveScaffold

## Overview

`KDAdaptiveScaffold` is the layout template that gives a screen its navigation shell. It renders
bottom navigation for `KDLayoutFamily.mobile`, a navigation rail for `KDLayoutFamily.wide`, and a
`KDSideBar` for `KDLayoutFamily.expanded`.

**`KDShellLayout` is the entry point a product destination uses.** It wraps this scaffold and adds
`KDTopBar`. Use `KDAdaptiveScaffold` directly only for a shell that needs no top bar.

It wraps the Flutter Material 3 `Scaffold`, `NavigationBar`, and `NavigationRail`.

Design link: the ELSA Design System page defines the method. See `../README.md` for the three
families.

## Component anatomy

| Element           | Type                      | Family             | Purpose                                                     |
| ----------------- | ------------------------- | ------------------ | ----------------------------------------------------------- |
| Shell             | `Scaffold`                | all                | Owns the app bar slot and the body slot                     |
| Bottom navigation | `NavigationBar`           | `mobile`           | Destination switch at the bottom edge                       |
| Navigation rail   | `NavigationRail`          | `wide`             | Destination switch at the start edge, labels always visible |
| Sidebar           | `KDSideBar`               | `expanded`         | Grouped destination list at the start edge                  |
| Rule              | `VerticalDivider` of 1 px | `wide`, `expanded` | Separates the navigation from the body                      |
| Body              | `Widget`                  | all                | The screen content                                          |
| App bar           | `PreferredSizeWidget?`    | all                | Optional title and actions                                  |

In the `wide` and `expanded` families the body sits in a `Row` next to the navigation and expands.
In the `mobile` family the body fills the whole `Scaffold` body.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDAdaptiveScaffold(
  destinations: const [
    KDDestination(label: 'Plan', icon: Icons.account_tree_outlined, selectedIcon: Icons.account_tree),
    KDDestination(label: 'Activity', icon: Icons.history_outlined, selectedIcon: Icons.history),
  ],
  selectedIndex: index,
  onDestinationSelected: (next) => setState(() => index = next),
  appBar: AppBar(title: const Text('KanthorD')),
  body: const NodeListView(),
);
```

## Properties

| Property                | Type                      | Default  | Purpose                             |
| ----------------------- | ------------------------- | -------- | ----------------------------------- |
| `destinations`          | `List<KDDestination>`     | required | The navigation targets, in order    |
| `sections`              | `List<KDSideBarSection>?` | `null`   | The sidebar groups, `expanded` only |
| `selectedIndex`         | `int`                     | required | The active destination              |
| `onDestinationSelected` | `ValueChanged<int>`       | required | Fires with the tapped index         |
| `body`                  | `Widget`                  | required | The screen content                  |
| `appBar`                | `PreferredSizeWidget?`    | `null`   | Optional app bar                    |
| `floatingActionButton`  | `Widget?`                 | `null`   | Optional action button              |

`sections` groups the destinations for the sidebar. A `null` value builds one unlabelled section
from `destinations`, so a caller that needs no group passes nothing. Both lists must describe the
same targets in the same order, because one `selectedIndex` serves all three families.

The selected index is a property, not internal state. The parent owns it.

## Methods

`KDAdaptiveScaffold` exposes no method. Change the destination by rebuilding with a new
`selectedIndex`.

## Related classes

### `KDDestination`

An immutable value class that describes one navigation target.

| Property       | Type       | Purpose                               |
| -------------- | ---------- | ------------------------------------- |
| `label`        | `String`   | Shown under the icon in both families |
| `icon`         | `IconData` | The unselected icon                   |
| `selectedIcon` | `IconData` | The selected icon                     |

### `KDLayout`

`KDAdaptiveScaffold` wraps itself in `KDLayout`, so it measures its own width and needs no
`KDLayout` ancestor. Read the resulting family below it with `context.kdLayout`.

## Technical notes

- The family comes from the width the scaffold receives, never from `Platform` and never from
  `MediaQuery`. `KDLayout` measures with `LayoutBuilder`. A 400 px pane inside a 1280 px window
  renders the `mobile` shell. That result is intended.
- The breakpoints are `kdWideBreakpoint`, which is `600`, and `kdExpandedBreakpoint`, which is
  `840`. Each boundary value belongs to the family above it.
- The rail uses `NavigationRailLabelType.all`, so a label is always visible.
- macOS, Windows, and Linux set a minimum window size of 480 by 640 logical pixels in native
  code. A desktop window can therefore reach the `mobile` family but never go below what it
  supports.
- Build one screen and branch inside it. Do not fork a screen into one file per family.
