# KDInputField

## Overview

`KDInputField` is the text entry atom. The `daemon_connect` feature needs two of them: the base URL
and the token. Read `../../../../docs/api/auth.md` for the provisioning flow they serve.

**The token field is the reason `isObscured` exists.** The daemon token never expires and cannot be
revoked from the client, so it must not sit in clear text on screen. It must also be readable on
demand, because the human types it by hand from the daemon configuration and needs to check it.

It wraps the Flutter Material 3 `TextField` and `InputDecoration`.

Design link: the ELSA Design System page defines the method. See `../README.md` for the tokens.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDInputField(
  label: 'Base URL',
  hint: 'http://127.0.0.1:8080',
  helper: 'The daemon has no default port. Enter the one it binds.',
  error: state.baseUrlError,
  keyboardType: TextInputType.url,
  onChanged: (value) => bloc.add(BaseUrlChanged(value)),
);

KDInputField(
  label: 'Token',
  isObscured: true,
  helper: 'The value of KANTHORD_HTTP_TOKEN on the daemon.',
  onChanged: (value) => bloc.add(TokenChanged(value)),
);
```

## Properties

| Property       | Type                     | Default  | Purpose                                        |
| -------------- | ------------------------ | -------- | ---------------------------------------------- |
| `label`        | `String`                 | required | The floating label                             |
| `initialValue` | `String?`                | `null`   | The starting text when no controller is given  |
| `controller`   | `TextEditingController?` | `null`   | Programmatic control of the text               |
| `hint`         | `String?`                | `null`   | The placeholder shown while the field is empty |
| `helper`       | `String?`                | `null`   | The line under the field                       |
| `error`        | `String?`                | `null`   | The error line. It replaces `helper`           |
| `isObscured`   | `bool`                   | `false`  | Hides the text and adds a reveal control       |
| `isEnabled`    | `bool`                   | `true`   | A disabled field takes no input                |
| `keyboardType` | `TextInputType?`         | `null`   | The soft keyboard on a touch platform          |
| `onChanged`    | `ValueChanged<String>?`  | `null`   | Fires on every keystroke                       |
| `onSubmitted`  | `ValueChanged<String>?`  | `null`   | Fires on the `Enter` key                       |

Pass a `controller` or an `initialValue`, never both. An assertion catches it in debug.

`error` is a `String?` rather than a `bool`, because a field that reports "wrong" without saying
what is wrong forces the human to guess. `docs/api/connectivity.md` lists the four connection
failures and each needs its own words.

## Methods

`KDInputField` exposes no method. Read and write the text through a `TextEditingController`.

## Related classes

### `TextEditingController`

The Flutter controller. `KDInputField` builds one internally when the caller passes none, and
disposes the one it built. It never disposes a controller the caller owns.

**Do not swap the controller after the first build.** The field reads it once. A caller that needs a
different value writes it into the controller it already passed.

## Technical notes

- The reveal state is internal, and this is the one place the design system keeps state the parent
  does not own. Whether the token is momentarily visible carries no meaning outside the field, and a
  property would force every caller to hold a `bool` for it. Selection and enablement stay
  properties, as `../../../../DESIGNS.md` requires.
- The reveal control is a `KDButton.icon` and it carries a tooltip, so it meets the icon-only rule in
  the input section of `../../../../DESIGNS.md`.
- The reveal control disables with the field. A disabled field must not leak the token.
- The shape comes from `InputDecorationTheme` in `KDTheme`, so the field hard-codes no radius.
- The field applies no validation. A base URL rule belongs to the bloc, which already holds the
  connection state and the four failure messages.
