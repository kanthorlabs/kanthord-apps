# Design rules

The rules that bind every piece of UI in this repository. `CLAUDE.md` references this document.

For the token values, the component list, and the per-component technical documents, read
`lib/libraries/kd_design_system/README.md` and `lib/libraries/kd_design_system/docs/`. This document
holds the rules. That package holds the values.

## Material 3 only

Use only the Flutter Material 3 design language. Add no third-party UI kit, no theme package, and
no component library.

Every `KD` component wraps a Material 3 component. Do not repaint pixels by hand.

## The `KD` prefix

Our design system lives in `lib/libraries/kd_design_system/`.

**Every public symbol the design system exports carries the `KD` prefix.** Inside a consumer's
file, a widget with no `KD` prefix is a Flutter widget.

The prefix rule binds the public API: the widgets, the value classes, the controllers, and the
token classes listed in `kd_design_system.dart`. It does not bind a private symbol, a private widget
local to one file, a `State` subclass, a field, or a local variable. `_SectionBody` inside
`kd_gallery_page.dart` is correct as written.

Use one name for one component across the design file, the technical document, and the code. Do not
rename a component in one place only.

## Atomic layering

Design around components, not around whole screens. Build the smallest independent parts first,
then compose them.

| Layer | Definition | Examples |
|---|---|---|
| Atom | The smallest element. You cannot subdivide it | text label, button, input field, icon |
| Molecule | A group of atoms that delivers one piece of data or one purpose | search field, card, check box, radio button, switch |
| Organism | A group of molecules that forms a complete, self-explanatory part of the UI | check box list, card list, card grid, app bar, tab bar |
| Template | A mixture of organisms that forms a complete page with demo or empty content | empty state view, dialog template |
| Page | A template plus real content | any feature screen |

An organism must stay understandable next to another context. A template defines order and
structure only. A page adds data.

Build the layers in order: tokens, then atoms, then molecules, then organisms, then templates. Do
not build a molecule before its atoms exist.

**Feature code builds pages. Feature code must not define a new atom.**

The layer of a component is a filing decision, not a design decision. A check box and a switch are
primitive controls, and they still file under `molecules/` because they combine a control with a
label. Do not spend time on the boundary. When a component is ambiguous, file it in the lower layer
and move on.

## Tokens

- Define every token one time in `styles/`. Expose tokens through a `ThemeExtension` subclass.
- Read tokens with `context.kdTokens`. Do not read a global constant inside a widget.
- Feature code hard-codes no color, no size, no radius, no duration, and no font. It reads the
  theme.
- Support a light theme and a dark theme.

Every current token value is seeded from the Material 3 baseline and marked `// TODO(tokens)`. The
seed color is `0xFF6750A4`. No value here is a brand value. Do not present a seeded value as final,
and do not invent a brand color.

## Component API

- One component per file. The file name matches the component in snake_case.
- Give every component the properties and the callbacks it needs. Name them by the standard:
  `isEnabled`, `isHighlighted`, `text`, `value`, `onTap`, `onChanged`, `onLongPress`, `onHover`.
- When a component needs programmatic control, give it a controller class, for example
  `KDTabBarController` with `void select(int index)`. Do not expose mutable state on the widget.
- Selection and enablement are properties, not internal state. The parent owns them.

## Build order per component

Follow this order every time. The document comes first.

1. Write the technical document at `lib/libraries/kd_design_system/docs/<component>.md`.
2. Implement the component.
3. Add the component to `KDGalleryPage`.
4. Verify it in the light theme, the dark theme, the `mobile` layout, and the `wide` layout.

Write no document for a component you have not built. Create no empty file and create no
placeholder component. Create a directory when you put the first file in it.

### Technical document sections

| Section | Content |
|---|---|
| Overview | Component name, usage, design link |
| Component anatomy | The named UI elements inside the component. Molecules, organisms, templates only |
| Setup | How to use the component in the codebase |
| Properties | Every property a developer reads or writes, plus every interaction callback |
| Methods | Every method that changes the component behavior or UI programmatically |
| Related classes | Controllers and delegates the component needs |
| Technical notes | Notes for the developer who implements the component |

An atom needs Overview, Properties, and Setup only.

## Layout family

Two families only.

| Family | Layout | Width |
|---|---|---|
| `KDLayoutFamily.mobile` | one pane, bottom navigation, full-screen routes | below `600` |
| `KDLayoutFamily.wide` | navigation rail, multi-pane, dialogs | `600` and above |

**The family comes from the available width, never from the platform.**

- `600` is the Material 3 boundary between the compact class and the medium class. The boundary
  value `600` belongs to `wide`.
- `context.kdLayout` is the only source of the family. Do not put `KDLayoutFamily` in `ThemeData`.
- `KDLayout` measures with `LayoutBuilder`, not `MediaQuery`, because a nested pane cares about the
  width it receives, not about the window width. Do not read `MediaQuery` for layout inside a
  feature widget.
- Branch on `KDLayoutFamily` for layout. Branch on `Theme.of(context).platform` only for platform
  behavior, such as a file picker or a window control.
- **Build each screen one time.** Branch inside the widget tree. Do not fork a screen into two files
  per family.
- Every feature uses `KDAdaptiveScaffold`.
- `KDPaneView` renders one pane for `mobile` and a list-detail split for `wide`.
- Route a destination that is a full screen on `mobile` to a `KDDialog` on `wide`.

The table below is the expected result on a normal window. It is an expectation, not a rule. The
width rule always wins.

| Platform | Expected family on a normal window |
|---|---|
| iOS, Android phone | `mobile` |
| macOS, Windows, Linux, web | `wide` |

A large Android tablet gets `wide`. A desktop window dragged below `600` gets `mobile`. Both results
are correct and intended.

### The two-family simplification

Material 3 defines a third size class, `expanded`, at `840` logical pixels, where a permanent drawer
replaces the rail. This project does not implement it. The rail is used at every width at or above
`600`.

Ask the owner before you add a third family.

macOS, Windows, and Linux set a minimum window size of 480 by 640 logical pixels in native code, so
no window becomes narrower than the `mobile` layout supports. Read `docs/operations.md` before you
touch a platform folder.

## Input

Every screen must work with a mouse and a keyboard, and with touch. All three, on every platform.

A minimum check before a screen is done:

- Every interactive element is reachable by `Tab` and activates with `Enter` or `Space`.
- Every interactive element has a visible focus indicator.
- Every icon-only control carries a tooltip or a semantic label.
- A pointer hover state exists wherever a tap state exists.

## The gallery

`KDGalleryPage` in `lib/libraries/kd_design_system/gallery/` is the showcase. It is a development
surface, not a product screen. It renders every component in both themes and both layout families.

Do not route to it from a feature and do not ship it as a product destination.
