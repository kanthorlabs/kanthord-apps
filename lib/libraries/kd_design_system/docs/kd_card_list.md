# KDCardList

## Overview

`KDCardList` is the organism that renders a scrollable, single-select list of `KDCard`
molecules. It is self-explanatory next to another context: a pane, a dialog, or a full screen.

It wraps the Flutter `ListView.separated`.

Design link: the ELSA Design System page defines the method. See `../README.md` for the token
state.

## Component anatomy

| Element           | Type                                  | Required | Purpose                                           |
| ----------------- | ------------------------------------- | -------- | ------------------------------------------------- |
| Scroll viewport   | `ListView.separated`                  | yes      | Owns the scroll and the item recycling            |
| Item              | `KDCard`                              | yes      | One record per item                               |
| Separator         | `SizedBox` of `KDTokens.spacing.sm`   | yes      | Vertical gap between two items                    |
| Outer padding     | `EdgeInsets` of `KDTokens.spacing.lg` | yes      | Inset from the pane edge                          |
| Empty placeholder | `Widget?`                             | no       | Replaces the whole viewport when `items` is empty |

The list has no header and no footer. A caller that needs a header composes it above the list
in a `Column` and wraps `KDCardList` in `Expanded`.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDCardList(
  items: const [
    KDCardListItem(
      id: 'planner',
      title: 'Planner agent',
      description: 'Breaks a request into ordered steps.',
      leading: Icon(Icons.account_tree_outlined),
    ),
  ],
  highlightedId: selectedId,
  onItemTap: (item) => select(item.id),
);
```

## Properties

| Property           | Type                            | Default  | Purpose                                                 |
| ------------------ | ------------------------------- | -------- | ------------------------------------------------------- |
| `items`            | `List<KDCardListItem>`          | required | The records to render, in order                         |
| `highlightedId`    | `String?`                       | `null`   | The `id` that renders as highlighted                    |
| `onItemTap`        | `ValueChanged<KDCardListItem>?` | `null`   | Fires with the tapped item                              |
| `onItemLongPress`  | `ValueChanged<KDCardListItem>?` | `null`   | Fires with the long-pressed item                        |
| `emptyPlaceholder` | `Widget?`                       | `null`   | Shown when `items` is empty. Falls back to an empty box |
| `scrollController` | `ScrollController?`             | `null`   | External scroll control                                 |
| `padding`          | `EdgeInsetsGeometry?`           | `null`   | Overrides the default outer padding                     |

Selection is a property, not internal state. The parent owns `highlightedId` and updates it in
`onItemTap`.

## Methods

`KDCardList` exposes no method. Scroll programmatically through the `scrollController` you
pass in.

## Related classes

### `KDCardListItem`

An immutable value class that describes one row.

| Property      | Type      | Default  | Purpose                                    |
| ------------- | --------- | -------- | ------------------------------------------ |
| `id`          | `String`  | required | Identity. Compared against `highlightedId` |
| `title`       | `String`  | required | Forwarded to `KDCard.title`                |
| `description` | `String?` | `null`   | Forwarded to `KDCard.description`          |
| `leading`     | `Widget?` | `null`   | Forwarded to `KDCard.leading`              |
| `trailing`    | `Widget?` | `null`   | Forwarded to `KDCard.trailing`             |
| `isEnabled`   | `bool`    | `true`   | Forwarded to `KDCard.isEnabled`            |

`KDCardList` needs no controller class. Scroll control uses the Flutter `ScrollController`.

## Technical notes

- The separator gap and the outer padding come from `context.kdTokens`. The organism defines no
  size of its own.
- `ListView.separated` builds items lazily. Keep `KDCardListItem` cheap to construct. A
  `leading` widget is built once per visible row, not once per list.
- The list matches an item by `id`, not by index. Reordering `items` keeps the selection.
- A disabled item still occupies a row and still scrolls. It reports no tap.
- `KDCardList` does not read `context.kdLayout`. Place it inside a pane and it fills that
  pane. The layout family belongs to the parent.
- When `items` is empty and `emptyPlaceholder` is `null`, the widget returns
  `SizedBox.shrink()`. Pass `KDEmptyStateView` once that template exists.
