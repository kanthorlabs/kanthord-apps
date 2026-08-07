# KDButton

## Overview

`KDButton` is the atom every action uses. It carries a label, an optional icon, and one of three
emphasis variants. `KDButton.icon` builds the icon-only form and requires a tooltip.

It wraps the Flutter Material 3 `FilledButton`, `OutlinedButton`, `TextButton`, and `IconButton`.

Design link: the ELSA Design System page defines the method. See `../README.md` for the tokens.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDButton(
  label: 'Connect',
  icon: Icons.link,
  isBusy: state.isProbing,
  onPressed: () => bloc.add(const ConnectRequested()),
);

KDButton.icon(
  icon: Icons.settings_outlined,
  tooltip: 'Open the settings',
  onPressed: openSettings,
);
```

## Properties

| Property    | Type              | Default   | Purpose                                                |
| ----------- | ----------------- | --------- | ------------------------------------------------------ |
| `label`     | `String`          | required  | The button text. `KDButton.icon` sets it to empty      |
| `icon`      | `IconData?`       | `null`    | Optional leading icon. Required by `KDButton.icon`     |
| `variant`   | `KDButtonVariant` | `primary` | The emphasis level                                     |
| `isEnabled` | `bool`            | `true`    | A disabled button reports no press                     |
| `isBusy`    | `bool`            | `false`   | Shows a progress indicator and refuses a press         |
| `onPressed` | `VoidCallback?`   | `null`    | Fires on a press, a `Enter` key, and a `Space` key     |
| `tooltip`   | `String?`         | `null`    | Hover and long-press text. Required by `KDButton.icon` |

`KDButtonVariant` maps `primary` to `FilledButton`, `secondary` to `OutlinedButton`, and `text` to
`TextButton`. `KDButton.icon` maps the same three to `IconButton.filled`, `IconButton.outlined`, and
the plain `IconButton`. `KDButton.icon` defaults to `text`, because an icon in a top bar carries low
emphasis.

`isBusy` and `isEnabled` are separate. A busy button stays visible and keeps its label, so the human
sees which action is in flight. Both states block `onPressed`.

The busy indicator takes the size from `IconTheme`, so it occupies the space the icon left.

Every state is a property. The parent owns it.
