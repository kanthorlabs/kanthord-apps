# KDPaneView

## Overview

`KDPaneView` is the list-detail region. It renders one pane for `KDLayoutFamily.mobile` and a list
beside a detail above it.

**It is not a page layout.** It lives in the content region of `KDShellLayout`, so the top bar and
the navigation stay up while the human moves between a row and its detail. Read the page layout
section of `../../../../DESIGNS.md`.

It composes `Row`, `VerticalDivider`, and `KDButton`. It paints no pixel of its own.

## Component anatomy

| Element     | Type                      | Family     | Purpose                                        |
| ----------- | ------------------------- | ---------- | ---------------------------------------------- |
| List        | `Widget`                  | all        | The rows, usually a `KDCardList`               |
| Detail      | `Widget?`                 | all        | The selected row. `null` means no selection    |
| Placeholder | `Widget?`                 | split only | Fills the detail pane when nothing is selected |
| Back        | `KDButton.icon`           | `mobile`   | Returns from the detail to the list            |
| Rule        | `VerticalDivider` of 1 px | split only | Separates the two panes                        |

In the split the list takes `listWidth` and the detail expands.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

KDPaneView(
  list: KDCardList(items: rows, highlightedId: state.selectedId, onItemTap: select),
  detail: state.selectedId == null ? null : NodeDetailView(id: state.selectedId!),
  onDetailClosed: () => bloc.add(const NodeDeselected()),
  placeholder: const KDStatusView(
    kind: KDStatusKind.empty,
    title: 'No node is selected',
    message: 'Choose a node to read its attempts and its checks.',
  ),
);
```

Put it in the `content` of `KDShellLayout`.

## Properties

| Property         | Type            | Default  | Purpose                                    |
| ---------------- | --------------- | -------- | ------------------------------------------ |
| `list`           | `Widget`        | required | The list pane                              |
| `detail`         | `Widget?`       | `null`   | The detail pane. `null` means no selection |
| `placeholder`    | `Widget?`       | `null`   | The detail pane when `detail` is `null`    |
| `onDetailClosed` | `VoidCallback?` | `null`   | Fires from the `mobile` back control       |
| `listWidth`      | `double?`       | `null`   | Overrides `sizing.paneListWidth`           |

**The selection is a property, not internal state.** `detail` is the whole signal: pass `null` for
no selection and pass the detail widget for a selection. The parent owns it, so a deep link that
opens a node needs no extra call.

`onDetailClosed` is required in practice on `mobile`. Without it the detail fills the pane and the
human has no way back to the list. The component renders no back control when it is `null`, because
a control that reports to nobody is worse than none.

## Methods

`KDPaneView` exposes no method.

## Related classes

None.

## Technical notes

- `KDPaneView` wraps itself in `KDLayout`, so it splits on the width **it** receives, never on the
  window width. This is the point of the component: the shell already spent width on the sidebar or
  the rail, and only the leftover decides whether two panes fit.
- A worked case: on a 900 px window the sidebar takes `sizing.sideBarWidth`, so the content region gets
  about 619 px and `KDPaneView` splits. On an 840 px window it gets about 559 px and stays single
  pane. Both results are correct.
- `KDTokens.sizing.paneListWidth` is `320`. At the `600` split boundary that leaves about 279 px for the detail,
  which is the narrowest useful detail. The value is a placeholder and carries `// TODO(tokens)`.
- The back control appears in the `mobile` family only. In the split both panes are on screen, so
  there is nothing to return from.
- The component scrolls neither pane. A pane scrolls itself, because a list and a detail scroll at
  different rates and a shared scroll would couple them.
