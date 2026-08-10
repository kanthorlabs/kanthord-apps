# Story 07 — the settings destination

> **SUPERSEDED on 2026-08-10 — re-expand before implementing.** The product holds more than
> one daemon, and `KanthordApi.withCandidate` replaces `ProbeClientBuilder`. Read the STOP
> block in `index.md` for this file's delta specification. Everything below still shows the
> shape, the guards and the tests that survive.

Epic: `.agent/plan/epics/003-daemon-connect.md`

Atomic layer: a **page part** over the `KDDialog` template. `KDDialog` already renders full screen
below `600` and as a dialog at `600` and above
(`lib/libraries/kd_design_system/layout/kd_dialog.dart:118-128`). The caller does not branch.

## Change

### `lib/**`

New file `lib/features/daemon_connect/settings/settings_dialog.dart`, verbatim:

```dart
import 'package:flutter/material.dart';

import '../../../libraries/kd_design_system/kd_design_system.dart';

@immutable
final class SettingsValues {
  const SettingsValues({required this.baseUrl, required this.token});

  final String baseUrl;
  final String token;
}

final class SettingsDialog extends StatefulWidget {
  const SettingsDialog({required this.baseUrl, required this.token, super.key});

  final String baseUrl;
  final String token;

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  late final TextEditingController _baseUrl = TextEditingController(text: widget.baseUrl);
  late final TextEditingController _token = TextEditingController(text: widget.token);

  @override
  void dispose() {
    _baseUrl.dispose();
    _token.dispose();
    super.dispose();
  }

  void _replace() {
    Navigator.of(context).pop(SettingsValues(baseUrl: _baseUrl.text, token: _token.text));
  }

  void _clearToken() {
    Navigator.of(context).pop(SettingsValues(baseUrl: _baseUrl.text, token: ''));
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return KDDialog(
      title: 'Daemon settings',
      onClose: () => Navigator.of(context).pop(),
      actions: <Widget>[
        KDButton(
          label: 'Clear the token',
          variant: KDButtonVariant.secondary,
          onPressed: _clearToken,
        ),
        KDButton(label: 'Replace', onPressed: _replace),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KDInputField(label: 'Daemon base URL', controller: _baseUrl),
          SizedBox(height: tokens.spacing.lg),
          KDInputField(label: 'Daemon token', controller: _token, isObscured: true),
        ],
      ),
    );
  }
}
```

### `test/**`

New file `test/features/daemon_connect/settings/settings_dialog_test.dart`, verbatim:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/features/daemon_connect/settings/settings_dialog.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_dialog.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

const Size _kMobile = Size(599, 900);
const Size _kWide = Size(600, 900);
const Size _kExpanded = Size(1280, 900);

const String _kBaseUrl = 'http://localhost:31415';
const String _kToken = 'a-token';

SettingsValues? result;

Future<void> _open(WidgetTester tester, Size size) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  result = null;
  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () async {
                result = await KDDialog.show<SettingsValues>(
                  context,
                  builder: (_) =>
                      const SettingsDialog(baseUrl: _kBaseUrl, token: _kToken),
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

Finder _fieldOf(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(TextField));

void main() {
  group('SettingsDialog', () {
    group('build', () {
      testWidgets('should open on the current values when the dialog is shown', (tester) async {
        // Arrange
        await _open(tester, _kExpanded);

        // Act
        final baseUrl = tester.widget<TextField>(_fieldOf('Daemon base URL')).controller!.text;
        final token = tester.widget<TextField>(_fieldOf('Daemon token')).controller!.text;

        // Assert
        expect(baseUrl, _kBaseUrl);
        expect(token, _kToken);
      });

      testWidgets('should obscure the token field when the dialog is shown', (tester) async {
        // Arrange
        await _open(tester, _kExpanded);

        // Act
        final field = tester.widget<TextField>(_fieldOf('Daemon token'));

        // Assert
        expect(field.obscureText, isTrue);
      });

      testWidgets('should render a dialog when the width is 600', (tester) async {
        // Arrange
        await _open(tester, _kWide);

        // Act
        final dialogs = find.byType(Dialog);

        // Assert
        expect(dialogs, findsOneWidget);
      });

      testWidgets('should render full screen when the width is 599', (tester) async {
        // Arrange
        await _open(tester, _kMobile);

        // Act
        final dialogs = find.byType(Dialog);

        // Assert
        expect(dialogs, findsNothing);
        expect(find.byType(AppBar), findsOneWidget);
      });
    });

    group('Replace', () {
      testWidgets('should return both entered values when Replace is pressed', (tester) async {
        // Arrange
        await _open(tester, _kExpanded);
        await tester.enterText(_fieldOf('Daemon base URL'), 'http://10.0.2.2:31415');
        await tester.enterText(_fieldOf('Daemon token'), 'a-new-token');

        // Act
        await tester.tap(find.text('Replace'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(KDDialog), findsNothing);
        expect(result!.baseUrl, 'http://10.0.2.2:31415');
        expect(result!.token, 'a-new-token');
      });
    });

    group('Clear the token', () {
      testWidgets('should empty the token when Clear the token is pressed', (tester) async {
        // Arrange
        await _open(tester, _kExpanded);

        // Act
        await tester.tap(find.text('Clear the token'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(KDDialog), findsNothing);
        expect(result!.token, '');
        expect(result!.baseUrl, _kBaseUrl);
      });
    });

    group('Close', () {
      testWidgets('should return nothing when the close control is pressed', (tester) async {
        // Arrange
        await _open(tester, _kExpanded);

        // Act
        await tester.tap(find.byTooltip('Close'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(KDDialog), findsNothing);
        expect(result, isNull);
      });
    });
  });
}
```

## Constraints

- The dialog returns a `SettingsValues` through `Navigator.of(context).pop`. It dispatches no bloc
  event and it reads no store. The connect page of Story 08 maps the result to events.
- `Navigator.of(context).pop` is legal. `scripts/arch-check.sh:70-71` bans the `push` forms alone.
- The dialog is the only place that clears the token. `Clear the token` returns an empty token, and
  Story 08 maps an empty token to `ConnectTokenCleared`.
- `Clear the token` never clears the base URL.
- The file holds no comment and hard-codes no design value.
- The test asserts the two layout branches at the boundary values `599` and `600`.
  `docs/testing.md:118-124`.

## Verify

- `make test-one T=test/features/daemon_connect/settings` exits 0.
- `make verify` exits 0.
- Proof: `PASS 003-G8-SETTINGS`.

## Tasks

### Task 007.1 — the settings dialog test

**Input:** `test/features/daemon_connect/settings/settings_dialog_test.dart`

**Action — RED:** write the file verbatim.

**Action — GREEN:** Task 007.2 creates the seam.

### Task 007.2 — the settings dialog

**Input:** `lib/features/daemon_connect/settings/settings_dialog.dart`

**Action — GREEN:** write the file verbatim.

**Action — REFACTOR:** none.
