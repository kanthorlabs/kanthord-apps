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

| Layer    | Definition                                                                   | Built                |
| -------- | ---------------------------------------------------------------------------- | -------------------- |
| Atom     | The smallest element. You cannot subdivide it                                | `KDText`             |
| Molecule | A group of atoms that delivers one piece of data or one purpose              | `KDCard`             |
| Organism | A group of molecules that forms a complete, self-explanatory part of the UI  | `KDCardList`         |
| Template | A mixture of organisms that forms a complete page with demo or empty content | `KDAdaptiveScaffold` |
| Page     | A template plus real content                                                 | Feature screens      |

The layer of a component is a filing decision, not a design decision.

Build order per component: technical document, implementation, showcase gallery entry, then
verification in the light theme, the dark theme, the `mobile` layout, and the `wide` layout.

## Components

| Component            | Layer           | File                               | Document                       |
| -------------------- | --------------- | ---------------------------------- | ------------------------------ |
| `KDText`             | atom            | `atoms/kd_text.dart`               | `docs/kd_text.md`              |
| `KDCard`             | molecule        | `molecules/kd_card.dart`           | `docs/kd_card.md`              |
| `KDCardList`         | organism        | `organisms/kd_card_list.dart`      | `docs/kd_card_list.md`         |
| `KDAdaptiveScaffold` | layout template | `layout/kd_adaptive_scaffold.dart` | `docs/kd_adaptive_scaffold.md` |

`KDGalleryPage` in `gallery/` is the showcase. It is a development surface, not a product
screen. It shows every component in both themes and both layout families.

## Layout family

Two families only.

| Family                  | Layout                                          | Width           |
| ----------------------- | ----------------------------------------------- | --------------- |
| `KDLayoutFamily.mobile` | one pane, bottom navigation, full-screen routes | below `600`     |
| `KDLayoutFamily.wide`   | navigation rail, multi-pane, dialogs            | `600` and above |

The family comes from the available width, never from the platform.

- `KDLayout` measures with `LayoutBuilder` and publishes the family through an
  `InheritedWidget`. It uses `LayoutBuilder`, not `MediaQuery`, because a nested pane cares
  about the width it receives, not about the window width.
- `context.kdLayout` is the only source of the family. `KDLayoutFamily` is not in `ThemeData`.
- Branch on `KDLayoutFamily` for layout. Branch on `Theme.of(context).platform` only for
  platform behavior, such as a file picker or a window control.
- Build each screen one time. Branch inside the widget tree. Do not fork a screen into one file
  per family.

A large Android tablet gets `wide`. A desktop window dragged below `600` gets `mobile`. Both
results are correct.

macOS, Windows, and Linux set a minimum window size of 480 by 640 logical pixels in native
code, so no window becomes narrower than the `mobile` layout supports.

### Two-family simplification

Material 3 defines a third size class, `expanded`, at `840` logical pixels, where a permanent
drawer replaces the rail. This project does not implement it. The rail is used at every width at
or above `600`.

Do not add a third family without approval.

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
