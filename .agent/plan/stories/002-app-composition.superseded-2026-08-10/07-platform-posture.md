# Story 07 — the platform posture

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: none. The human pre-step must land before Task 007.1 runs, because the script asserts
the files.

## Change

### Human pre-step — the Android and iOS files. **APPLIED**

`scripts/lane-check.sh:47` denies `android/*` and `ios/*` to every role. The human applied the three
edits below before dispatch. `plutil -lint ios/Runner/Info.plist` reports `OK`, and both Android
files parse.

- New `android/app/src/main/res/xml/network_security_config.xml`:

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <network-security-config>
      <base-config cleartextTrafficPermitted="true" />
  </network-security-config>
  ```

- `android/app/src/main/AndroidManifest.xml:2-5`, add two attributes to the `<application>` element,
  after `android:icon="@mipmap/ic_launcher"`:

  ```xml
  android:usesCleartextTraffic="true"
  android:networkSecurityConfig="@xml/network_security_config"
  ```

  `src/main` applies to every variant. `src/debug/AndroidManifest.xml` and
  `src/profile/AndroidManifest.xml` declare the `INTERNET` permission only, and they stay unchanged.

- `ios/Runner/Info.plist`, add before the closing `</dict>`:

  ```xml
  <key>NSAppTransportSecurity</key>
  <dict>
  	<key>NSAllowsArbitraryLoads</key>
  	<true/>
  </dict>
  ```

  The file uses tab indentation. Match it.

### `scripts/**`

- New `scripts/platform-config-check.sh`, executable (`chmod +x`):

  ```bash
  #!/usr/bin/env bash
  set -uo pipefail

  # One grep per mobile target: the cleartext permission is declared.
  # It cannot prove a build-time file admits a runtime host, and it claims no
  # such thing. Read the cleartext section of docs/api/connectivity.md.

  here=$(cd "$(dirname "$0")" && pwd)
  root=$(cd "$here/.." && pwd)
  cd "$root"

  status=0

  require() {
    local what=$1 file=$2 pattern=$3
    if [ ! -f "$file" ]; then
      echo "platform config: FAIL — $file is missing ($what)" >&2
      status=1
      return
    fi
    if ! grep -qF "$pattern" "$file"; then
      echo "platform config: FAIL — $file does not declare $pattern ($what)" >&2
      status=1
    fi
  }

  require "android cleartext, every variant" \
    android/app/src/main/res/xml/network_security_config.xml \
    'cleartextTrafficPermitted="true"'
  require "android network security config is wired to the application" \
    android/app/src/main/AndroidManifest.xml \
    'android:networkSecurityConfig="@xml/network_security_config"'
  require "android usesCleartextTraffic" \
    android/app/src/main/AndroidManifest.xml \
    'android:usesCleartextTraffic="true"'
  require "ios app transport security" \
    ios/Runner/Info.plist \
    '<key>NSAppTransportSecurity</key>'

  # A key grep alone passes a plist that sets the key to <false/>. Strip the
  # whitespace, join the lines, and require the key and the value together.
  if [ -f ios/Runner/Info.plist ]; then
    if ! tr -d ' \t\n\r' <ios/Runner/Info.plist |
      grep -qF '<key>NSAllowsArbitraryLoads</key><true/>'; then
      echo "platform config: FAIL — ios/Runner/Info.plist does not set NSAllowsArbitraryLoads to true" >&2
      status=1
    fi
  fi

  if [ "$status" -eq 0 ]; then
    echo "platform config: PASS — android, ios"
  fi

  exit "$status"
  ```

## Constraints

- The exception is broad and it applies to every build variant. No `NSExceptionDomains` entry and no
  `<domain-config>` element. `docs/api/connectivity.md` records the decision: a build-time file
  cannot name a host the human types at runtime.
- The script greps and nothing else. It runs no build, boots no device and asserts no enforcement.
- The script gets no `scripts/platform-config-check.test.sh`. `scripts/*.test.sh` is denied to every
  role at `scripts/lane-check.sh:40-42`, and `Makefile:119-123` names each `pipeline-test` entry
  explicitly, so a new self-test would neither be writable nor run. The EPIC Proof calls the script
  directly.
- The script touches no desktop and no web target. Neither has a cleartext policy.

## Tasks

### Task 007.1 — the platform config check

**Input:** `scripts/platform-config-check.sh`

**Action — GREEN:** write the file exactly as the `## Change` section states and make it executable.

**Action — REFACTOR:** none.

This Task writes a shell script and no Dart. It has no RED step, because the test-engineer lane is
`test/**` and `flutter_test` cannot assert a shell script. The pass/fail check is the script's own
exit code under the EPIC Proof.

## Verify

- `scripts/platform-config-check.sh` exits 0 and prints `platform config: PASS — android, ios`.
- Rename `android/app/src/main/res/xml/network_security_config.xml` aside, re-run, and confirm the
  script exits 1 and names the missing file. Restore the file.
- Change the iOS `<true/>` to `<false/>`, re-run, and confirm the script exits 1 and names
  `NSAllowsArbitraryLoads`. Restore the value. A key-only grep passes this case, and the check must
  not.
- `make verify` exits 0.
- `NEEDS-HUMAN:` whether Android and iOS actually block a Dart cleartext socket. Dart sockets do not
  always go through the platform HTTP stack, so the enforcement is a device measurement. The script
  proves the declaration and nothing else.
- Proof: `PASS 002-G7-PLATFORM`.
