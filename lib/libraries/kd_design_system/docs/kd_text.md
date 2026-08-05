# KDText

## Overview

`KDText` is the atom that renders a string with a type scale role and a color tone. Every
string in the app goes through it. It wraps the Flutter `Text` widget.

The role selects a `TextStyle` from `TextTheme`. The tone selects a color from `ColorScheme`.
A caller never passes a raw `TextStyle` and never passes a raw `Color`.

Design link: the ELSA Design System page defines the method. The type scale comes from the
Material 3 baseline. See `../README.md` for the token state.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDText('Planner agent', role: KDTextRole.titleMedium);
KDText('Not available right now.', tone: KDTextTone.secondary);
KDText('The request failed.', tone: KDTextTone.error);
```

## Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `text` | `String` | required, positional | The string to render |
| `role` | `KDTextRole` | `bodyMedium` | Selects the `TextTheme` style |
| `tone` | `KDTextTone` | `primary` | Selects the `ColorScheme` color |
| `maxLines` | `int?` | `null` | Caps the line count |
| `textAlign` | `TextAlign?` | `null` | Horizontal alignment |
| `overflow` | `TextOverflow?` | `null` | Overflow behavior. Defaults to `ellipsis` when `maxLines` is set |

`KDTextRole` has one value per Material 3 type scale role, from `displayLarge` to
`labelSmall`.

`KDTextTone` maps to `ColorScheme` roles:

| Tone | Color |
|---|---|
| `primary` | `onSurface` |
| `secondary` | `onSurfaceVariant` |
| `error` | `error` |
| `onAccent` | `onPrimary` |

`KDText` has no interaction callback. It is not interactive.
