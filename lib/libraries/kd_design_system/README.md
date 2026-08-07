# KD design system

The KD design system is our layer on top of Flutter Material 3. It adds no third-party UI kit,
no theme package, and no component library.

Every symbol we own carries the `KD` prefix. A widget with no `KD` prefix is a Flutter widget.

## Rules

- Every `KD` component wraps a Material 3 component. No component paints pixels by hand.
- Every token is defined one time in `styles/` and is exposed through a `ThemeExtension`.
- Feature code hard-codes no color, no size, no radius, no duration, and no font. It reads the
  theme.
- Feature code builds pages. Feature code defines no atom.
- Light theme and dark theme are both supported.

## Layers

| Layer    | Definition                                                                   | Built                                 |
| -------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Atom     | The smallest element. You cannot subdivide it                                | `KDText`, `KDButton`, `KDInputField`  |
| Molecule | A group of atoms that delivers one piece of data or one purpose              | `KDCard`, `KDBrand`                   |
| Organism | A group of molecules that forms a complete, self-explanatory part of the UI  | `KDCardList`, `KDTopBar`, `KDSideBar` |
| Template | A mixture of organisms that forms a complete page with demo or empty content | `KDShellLayout`                       |
| Page     | A template plus real content                                                 | Feature screens                       |

The layer of a component is a filing decision, not a design decision.

Build order per component: technical document, implementation, showcase gallery entry, then
verification in the light theme and the dark theme, at the `mobile`, `wide`, and `expanded` widths.

## Components

| Component            | Layer           | File                                | Document                        |
| -------------------- | --------------- | ----------------------------------- | ------------------------------- |
| `KDText`             | atom            | `atoms/kd_text.dart`                | `docs/kd_text.md`               |
| `KDButton`           | atom            | `atoms/kd_button.dart`              | `docs/kd_button.md`             |
| `KDInputField`       | atom            | `atoms/kd_input_field.dart`         | `docs/kd_input_field.md`        |
| `KDCard`             | molecule        | `molecules/kd_card.dart`            | `docs/kd_card.md`               |
| `KDBrand`            | molecule        | `molecules/kd_brand.dart`           | `docs/kd_brand.md`              |
| `KDCardList`         | organism        | `organisms/kd_card_list.dart`       | `docs/kd_card_list.md`          |
| `KDTopBar`           | organism        | `organisms/kd_top_bar.dart`         | `docs/kd_top_bar.md`            |
| `KDSideBar`          | organism        | `organisms/kd_side_bar.dart`        | `docs/kd_side_bar.md`           |
| `KDAdaptiveScaffold` | layout template | `layout/kd_adaptive_scaffold.dart`  | `docs/kd_adaptive_scaffold.md`  |
| `KDStatusView`       | layout template | `layout/kd_status_view.dart`        | `docs/kd_status_view.md`        |
| `KDPaneView`         | layout template | `layout/kd_pane_view.dart`          | `docs/kd_pane_view.md`          |
| `KDDialog`           | layout template | `layout/kd_dialog.dart`             | `docs/kd_dialog.md`             |
| `KDFullScreenLayout` | page layout     | `layout/kd_full_screen_layout.dart` | `docs/kd_full_screen_layout.md` |
| `KDShellLayout`      | page layout     | `layout/kd_shell_layout.dart`       | `docs/kd_shell_layout.md`       |

`KDGalleryPage` in `gallery/` is the showcase. It is a development surface, not a product
screen. It shows every component in both themes and all three layout families, and it builds
itself with `KDShellLayout`.

## Page layout

Two page layouts. Every screen is one of them.

| Layout               | Structure                           | Used for                                 |
| -------------------- | ----------------------------------- | ---------------------------------------- |
| `KDFullScreenLayout` | One centered column, no navigation  | Connect, unauthorized, boot, unreachable |
| `KDShellLayout`      | Top bar, navigation, content region | Every product destination                |

Choose by what is reachable. A client with no daemon reaches no destination and gets the full
screen. A destination that answers `501` keeps every other destination working, so the shell stays
up and `KDStatusView` reports the state in the content region.

`KDPaneView` and `KDDialog` carry the rest. The list-detail split belongs in the content region and
a dialog belongs above either layout. Neither is a third page layout. Both are built.

## Layout family

Three families. They set the navigation of `KDShellLayout`, not the page layout.

| Family                    | Layout                                          | Width           |
| ------------------------- | ----------------------------------------------- | --------------- |
| `KDLayoutFamily.mobile`   | one pane, bottom navigation, full-screen routes | below `600`     |
| `KDLayoutFamily.wide`     | navigation rail, multi-pane, dialogs            | `600` to `839`  |
| `KDLayoutFamily.expanded` | permanent sidebar, multi-pane, dialogs          | `840` and above |

The family comes from the available width, never from the platform.

- `KDLayout` measures with `LayoutBuilder` and publishes the family through an
  `InheritedWidget`. It uses `LayoutBuilder`, not `MediaQuery`, because a nested pane cares
  about the width it receives, not about the window width.
- `context.kdLayout` is the only source of the family. `KDLayoutFamily` is not in `ThemeData`.
- Branch on `KDLayoutFamily` for layout. Branch on `Theme.of(context).platform` only for
  platform behavior, such as a file picker or a window control.
- Build each screen one time. Branch inside the widget tree. Do not fork a screen into one file
  per family.

A desktop window dragged below `840` gets `wide`, and below `600` it gets `mobile`. Every result
is correct.

A nested pane resolves its own family. On an `840` window the sidebar takes `sizing.sideBarWidth`, so
the content region receives about `559` and resolves to `mobile`.

macOS, Windows, and Linux set a minimum window size of 480 by 640 logical pixels in native
code, so no window becomes narrower than the `mobile` layout supports.

Do not add a fourth family without approval.

## Tokens

Every token below is seeded from the Material 3 baseline. The ELSA Design System page defines
the method but not the values. Every seeded value is marked `// TODO(tokens)` in the source and
waits for the real palette and scales from the design file.

Read tokens with `context.kdTokens`, which resolves the `KDTokens` `ThemeExtension`.

### Color

`ColorScheme.fromSeed` generates both schemes from one seed.

| Token              | Value                                          | State                                        |
| ------------------ | ---------------------------------------------- | -------------------------------------------- |
| `KDColors.seed`    | `0xFF6750A4`                                   | Seeded. The Flutter Material 3 baseline seed |
| `KDColors.light()` | `ColorScheme.fromSeed(seed, Brightness.light)` | Derived                                      |
| `KDColors.dark()`  | `ColorScheme.fromSeed(seed, Brightness.dark)`  | Derived                                      |

Components read `ColorScheme` roles, never a literal color. `KDText` maps its tones as
`primary` to `onSurface`, `secondary` to `onSurfaceVariant`, `error` to `error`, and `onAccent`
to `onPrimary`.

### Status color

`KDTokens.statusColors`. **Material 3 defines no success role and no warning role**, so this group
exists to fill that gap rather than to restate the scheme. `KDTopBar` and `KDStatusView` both read
it, so a healthy daemon and a healthy node never drift apart.

| Token     | Seeded from               | Used for                                     |
| --------- | ------------------------- | -------------------------------------------- |
| `healthy` | `scheme.primary`          | `connected`                                  |
| `warning` | `scheme.tertiary`         | `degraded`                                   |
| `danger`  | `scheme.error`            | `unauthorized`, `unreachable`, an error view |
| `neutral` | `scheme.onSurfaceVariant` | `connecting`, an empty view, a `501` view    |

`healthy` and `warning` are the two the scheme cannot supply. The other two restate a real role and
exist so a caller reads one palette rather than two.

An activity indicator stays on `scheme.primary`. Work in progress is not a status.

### Spacing

A 4-point scale. `KDTokens.spacing`.

| Token  | Value |
| ------ | ----- |
| `xs`   | 4     |
| `sm`   | 8     |
| `md`   | 12    |
| `lg`   | 16    |
| `xl`   | 24    |
| `xxl`  | 32    |
| `xxxl` | 48    |

### Radius

`KDTokens.radius`.

| Token  | Value |
| ------ | ----- |
| `xs`   | 4     |
| `sm`   | 8     |
| `md`   | 12    |
| `lg`   | 16    |
| `full` | 9999  |

### Duration

`KDTokens.duration`.

| Token    | Value  |
| -------- | ------ |
| `fast`   | 100 ms |
| `normal` | 200 ms |
| `slow`   | 400 ms |

### Elevation

`KDTokens.elevation`.

| Token    | Value |
| -------- | ----- |
| `none`   | 0     |
| `low`    | 1     |
| `medium` | 3     |
| `high`   | 6     |

### Sizing

`KDTokens.sizing`. Layout measures a component cannot derive from the spacing scale.

| Token              | Value | Used by                                                       |
| ------------------ | ----- | ------------------------------------------------------------- |
| `contentMaxWidth`  | 480   | `KDFullScreenLayout`, `KDStatusView`, a `standard` `KDDialog` |
| `sideBarWidth`     | 280   | `KDSideBar`. The Material modal `Drawer` default is 304       |
| `paneListWidth`    | 320   | The list pane of `KDPaneView`                                 |
| `dialogLargeWidth` | 800   | A `large` `KDDialog`: a blob viewer and the plan import       |

A component that takes a width override declares it as `double?` and falls back to this group, which
is the Material pattern. A default parameter cannot read the theme, so `null` is the only default
that lets the token win.

`kdWideBreakpoint` and `kdExpandedBreakpoint` are **not** here. A breakpoint is structure, not
theme: `KDLayout.familyForWidth` is a pure function and a theme must not be able to move a family
boundary. They stay as constants in `layout/kd_layout.dart`.

### Type scale

`KDTextStyles.textTheme(brightness)` returns the Material 3 2021 type scale.
`KDTextRole` has one value per role, from `displayLarge` to `labelSmall`.

## Files not created

The target tree lists two files this package does not contain, because a placeholder file is
forbidden:

| File                           | Reason                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `styles/kd_fonts.dart`         | No custom font asset exists. The Material 3 baseline uses the platform default font |
| `styles/kd_shadow_styles.dart` | Material 3 expresses depth with elevation. No component needs a hand-built shadow   |

Create each file when a real value arrives.
