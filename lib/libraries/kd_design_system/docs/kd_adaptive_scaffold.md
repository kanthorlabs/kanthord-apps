# KDAdaptiveScaffold

## Overview

`KDAdaptiveScaffold` is the layout template that gives a screen its navigation shell. It renders
bottom navigation for `KDLayoutFamily.mobile` and a navigation rail for `KDLayoutFamily.wide`.
Every feature screen uses it.

It wraps the Flutter Material 3 `Scaffold`, `NavigationBar`, and `NavigationRail`.

Design link: the ELSA Design System page defines the method. See `../README.md` for the
two-family simplification.

## Component anatomy

| Element | Type | Family | Purpose |
|---|---|---|---|
| Shell | `Scaffold` | both | Owns the app bar slot and the body slot |
| Bottom navigation | `NavigationBar` | `mobile` | Destination switch at the bottom edge |
| Navigation rail | `NavigationRail` | `wide` | Destination switch at the start edge, labels always visible |
| Rail divider | `VerticalDivider` of 1 px | `wide` | Separates the rail from the body |
| Body | `Widget` | both | The screen content |
| App bar | `PreferredSizeWidget?` | both | Optional title and actions |

In the `wide` family the body sits in a `Row` next to the rail and expands. In the `mobile`
family the body fills the whole `Scaffold` body.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDAdaptiveScaffold(
  destinations: const [
    KDDestination(label: 'Chat', icon: Icons.chat_outlined, selectedIcon: Icons.chat),
    KDDestination(label: 'Agents', icon: Icons.smart_toy_outlined, selectedIcon: Icons.smart_toy),
  ],
  selectedIndex: index,
  onDestinationSelected: (next) => setState(() => index = next),
  appBar: AppBar(title: const Text('KanthorD')),
  body: const AgentChatView(),
);
```

## Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `destinations` | `List<KDDestination>` | required | The navigation targets, in order |
| `selectedIndex` | `int` | required | The active destination |
| `onDestinationSelected` | `ValueChanged<int>` | required | Fires with the tapped index |
| `body` | `Widget` | required | The screen content |
| `appBar` | `PreferredSizeWidget?` | `null` | Optional app bar |
| `floatingActionButton` | `Widget?` | `null` | Optional action button |

The selected index is a property, not internal state. The parent owns it.

## Methods

`KDAdaptiveScaffold` exposes no method. Change the destination by rebuilding with a new
`selectedIndex`.

## Related classes

### `KDDestination`

An immutable value class that describes one navigation target.

| Property | Type | Purpose |
|---|---|---|
| `label` | `String` | Shown under the icon in both families |
| `icon` | `IconData` | The unselected icon |
| `selectedIcon` | `IconData` | The selected icon |

### `KDLayout`

`KDAdaptiveScaffold` wraps itself in `KDLayout`, so it measures its own width and needs no
`KDLayout` ancestor. Read the resulting family below it with `context.kdLayout`.

## Technical notes

- The family comes from the width the scaffold receives, never from `Platform` and never from
  `MediaQuery`. `KDLayout` measures with `LayoutBuilder`. A 400 px pane inside a 1280 px window
  renders the `mobile` shell. That result is intended.
- The breakpoint is `kdWideBreakpoint`, which is `600`. Below `600` the family is `mobile`. At
  `600` and above the family is `wide`. The boundary value `600` belongs to `wide`.
- The rail uses `NavigationRailLabelType.all`, so a label is always visible. This project has no
  `expanded` family and no permanent drawer.
- macOS, Windows, and Linux set a minimum window size of 480 by 640 logical pixels in native
  code. A desktop window can therefore reach the `mobile` family but never go below what it
  supports.
- Build one screen and branch inside it. Do not fork a screen into one file per family.
