# KDShellLayout

## Overview

`KDShellLayout` is the second of the two page layouts, and it is the one every product destination
uses. It gives a top bar, a navigation region, and a content region.

The navigation region changes with the width and the content region never does:

| Family     | Width      | Navigation                    |
| ---------- | ---------- | ----------------------------- |
| `mobile`   | below 600  | `NavigationBar` at the bottom |
| `wide`     | 600 to 839 | `NavigationRail` at the start |
| `expanded` | 840 and up | `KDSideBar` at the start      |

`KDShellLayout` composes `KDTopBar` and `KDAdaptiveScaffold`. `KDAdaptiveScaffold` owns the family
branch, so the branch is written one time.

**The content region hosts every state.** A list, a detail, a `KDStatusView` for loading, empty,
error or `501` — all of them render there while the top bar and the navigation stay up. Only a
failure that reaches no destination replaces the whole page, and that one uses
`KDFullScreenLayout`.

## Component anatomy

| Element    | Type              | Family             | Purpose                                    |
| ---------- | ----------------- | ------------------ | ------------------------------------------ |
| Top bar    | `KDTopBar`        | all                | Brand, page title, daemon state, actions   |
| Bottom bar | `NavigationBar`   | `mobile`           | Destination switch at the bottom edge      |
| Rail       | `NavigationRail`  | `wide`             | Destination switch at the start edge       |
| Sidebar    | `KDSideBar`       | `expanded`         | Grouped destination list at the start edge |
| Rule       | `VerticalDivider` | `wide`, `expanded` | Separates navigation from content          |
| Content    | `Widget`          | all                | The destination content                    |

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDShellLayout(
  title: 'Nodes',
  status: KDConnectionStatus.connected,
  onStatusPressed: openDaemonSettings,
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
  content: const NodeListView(),
);
```

## Properties

| Property                | Type                     | Default  | Purpose                                      |
| ----------------------- | ------------------------ | -------- | -------------------------------------------- |
| `sections`              | `List<KDSideBarSection>` | required | The destination groups, in order             |
| `selectedIndex`         | `int`                    | required | The active destination, flat across sections |
| `onDestinationSelected` | `ValueChanged<int>`      | required | Fires with the tapped index                  |
| `content`               | `Widget`                 | required | The content region                           |
| `title`                 | `String?`                | `null`   | The page name in the top bar                 |
| `status`                | `KDConnectionStatus?`    | `null`   | The daemon state in the top bar              |
| `statusDetail`          | `String?`                | `null`   | The status tooltip text                      |
| `onStatusPressed`       | `VoidCallback?`          | `null`   | Opens the daemon settings                    |
| `actions`               | `List<Widget>`           | `[]`     | The page actions in the top bar              |
| `floatingActionButton`  | `Widget?`                | `null`   | The primary action of the destination        |

`selectedIndex` counts destinations only and it runs across every section. A section label costs no
index. The same index selects the same destination in all three families.

The selected index is a property, not internal state. The parent owns it.

## Methods

`KDShellLayout` exposes no method. Change the destination by rebuilding with a new `selectedIndex`.

## Related classes

### `KDSideBarSection`

Defined with `KDSideBar`. `KDShellLayout` takes sections rather than a flat destination list,
because the sidebar groups them and the rail and the bottom bar flatten them.

### `KDAdaptiveScaffold`

`KDShellLayout` passes the flattened destinations, the sections, and the top bar to it, and reads the
family branch back. Use `KDAdaptiveScaffold` directly only for a shell that needs no top bar.

## Technical notes

- The section labels appear in the `expanded` family only. The rail and the bottom bar render a flat
  list, because neither has a place for a group label. The order is preserved, so the grouping still
  reads as adjacency.
- `KDAdaptiveScaffold` wraps itself in `KDLayout`, so the content region reads `context.kdLayout`
  without an ancestor of its own. A content region narrower than the window resolves its own family,
  which is what a nested pane needs.
- The content region receives the width that is left after the navigation. On an 840 px window the
  sidebar takes `sizing.sideBarWidth`, so the content region receives about 559 px and resolves to
  `mobile`. That result is intended and it is the reason a nested pane measures itself.
- **Known limit: the bottom bar crowds above five destinations.** Material 3 caps a `NavigationBar`
  at five, and the daemon has more destinations than that. The `mobile` family therefore needs a
  drawer or a grouped overflow before this ships to a phone. The owner scoped this pass to desktop,
  so the limit is recorded rather than solved.
