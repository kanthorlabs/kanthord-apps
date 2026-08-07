# KDBrand

## Overview

`KDBrand` is the product signature. It renders the mark and the wordmark at one of three sizes.
`KDTopBar` puts it at the start edge and `KDFullScreenLayout` puts it above the content.

It composes a Flutter Material `Icon` and `KDText`. It paints no pixel of its own.

Design link: the ELSA Design System page defines the method. The mark below is a placeholder.

## Component anatomy

| Element  | Type     | Purpose                                           |
| -------- | -------- | ------------------------------------------------- |
| Mark     | `Icon`   | The graph glyph, painted in `ColorScheme.primary` |
| Wordmark | `KDText` | The product name, `KanthorD`                      |

The mark and the wordmark sit in a `Row` with `MainAxisSize.min`, so the brand takes the width it
needs and never expands.

## Setup

```dart
import '../../libraries/kd_design_system/kd_design_system.dart';

const KDBrand();

const KDBrand(size: KDBrandSize.large);

const KDBrand(size: KDBrandSize.small, showWordmark: false);
```

## Properties

| Property       | Type          | Default  | Purpose                                  |
| -------------- | ------------- | -------- | ---------------------------------------- |
| `size`         | `KDBrandSize` | `medium` | The mark size and the wordmark type role |
| `showWordmark` | `bool`        | `true`   | Set it to `false` for a mark-only lockup |

`KDBrandSize` resolves against the tokens:

| Size     | Mark size          | Wordmark role    | Used by                    |
| -------- | ------------------ | ---------------- | -------------------------- |
| `small`  | `spacing.xl`, 24   | `titleSmall`     | A collapsed sidebar header |
| `medium` | `spacing.xxl`, 32  | `titleLarge`     | `KDTopBar`                 |
| `large`  | `spacing.xxxl`, 48 | `headlineMedium` | `KDFullScreenLayout`       |

## Methods

`KDBrand` exposes no method.

## Related classes

### `KDBrandSize`

An enum with three values. It selects the mark size and the wordmark type role together, so the two
never drift apart.

## Technical notes

- The mark reads `ColorScheme.primary` from the theme. It hard-codes no color, so it inverts with
  the dark theme without a second asset.
- The current mark is `Icons.hub_rounded`. **It is a placeholder.** No brand asset exists yet, and
  `../README.md` records that every token is still seeded. Replace the mark when the design file
  supplies one.
- A mark-only brand carries `semanticLabel`, because the wordmark is the only text a screen reader
  would otherwise read.
- The wordmark string lives in one private constant. Do not write the product name in a feature
  file.
