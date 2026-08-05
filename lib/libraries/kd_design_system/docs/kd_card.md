# KDCard

## Overview

`KDCard` is the molecule that shows one record as a tappable surface. It carries one piece of
data and one purpose. It wraps the Flutter Material 3 `Card`.

Use it for a list row, a grid cell, or a standalone summary. Do not put a form inside it.

Design link: the ELSA Design System page defines the method. See `../README.md` for the token
state.

## Component anatomy

| Element | Type | Required | Purpose |
|---|---|---|---|
| Leading slot | `Widget?` | no | An icon or an avatar at the start edge |
| Title | `KDText` with `titleMedium` | yes | The record name |
| Description | `KDText` with `bodyMedium` and `secondary` tone | no | Up to 3 lines, then ellipsis |
| Trailing slot | `Widget?` | no | A chevron, a switch, or a menu button at the end edge |
| Surface | Flutter `Card` | yes | Holds the elevation, the radius, and the highlight border |

The title and the description stack in a `Column`. The column expands, so the leading and the
trailing slots keep their intrinsic width.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDCard(
  title: 'Planner agent',
  description: 'Breaks a request into ordered steps.',
  leading: const Icon(Icons.account_tree_outlined),
  trailing: const Icon(Icons.chevron_right),
  isHighlighted: selectedId == 'planner',
  onTap: () => select('planner'),
);
```

## Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `title` | `String` | required | The record name |
| `description` | `String?` | `null` | Supporting text, capped at 3 lines |
| `leading` | `Widget?` | `null` | Start-edge slot |
| `trailing` | `Widget?` | `null` | End-edge slot |
| `isEnabled` | `bool` | `true` | `false` dims the card and blocks every pointer event |
| `isHighlighted` | `bool` | `false` | `true` draws a 2 px `primary` border and raises the elevation |
| `onTap` | `VoidCallback?` | `null` | Fires on a tap or a click |
| `onLongPress` | `VoidCallback?` | `null` | Fires on a long press or a right-hold |
| `onHover` | `ValueChanged<bool>?` | `null` | Fires when the pointer enters and leaves |

The card adds an `InkWell` only when `onTap` or `onLongPress` is set. A card with no callback
takes no focus and shows no ripple.

`isEnabled: false` wraps the card in `Opacity` and `IgnorePointer`. The callbacks stay
attached but never fire.

## Methods

`KDCard` exposes no method. It is stateless and fully driven by its properties.

## Related classes

`KDCard` needs no controller and no delegate. The parent owns the selection state and passes
it through `isHighlighted`.

For a list of cards use `KDCardList`, which owns the separators and the padding. See
`kd_card_list.md`.

## Technical notes

- The radius comes from `KDTokens.radius.md`. The elevation comes from `KDTokens.elevation`.
  The padding comes from `KDTokens.spacing.lg`. Read them with `context.kdTokens`.
- `clipBehavior` is `Clip.antiAlias`, so the ripple stays inside the rounded corners.
- The highlight border is `BorderSide.none` when `isHighlighted` is `false`. A transparent
  border would still consume layout width and shift the content by 2 px.
- The description tone is `secondary`, never a hard-coded gray.
- `KDCard` does not read `context.kdLayout`. It fills the width it receives. The parent
  decides the width per layout family.
