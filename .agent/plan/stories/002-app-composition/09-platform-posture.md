# Story 09 — the platform posture

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: none. The human pre-step is on disk, and Task 009.1 asserts it.

## Change

### Human pre-step — the Android and iOS files. **APPLIED**

`scripts/lane-check.sh:47` denies `android/*` and `ios/*` to every role. All three edits are on disk
and verified.

- `android/app/src/main/res/xml/network_security_config.xml:1-4`:

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <network-security-config>
      <base-config cleartextTrafficPermitted="true" />
  </network-security-config>
  ```

  `<base-config>` and no `<domain-config>`, so the permit is unconditional.

- `android/app/src/main/AndroidManifest.xml:6-7`, two attributes on the `<application>` element:

  ```xml
  android:usesCleartextTraffic="true"
  android:networkSecurityConfig="@xml/network_security_config"
  ```

  `src/main` applies to every variant. `src/debug/AndroidManifest.xml` and
  `src/profile/AndroidManifest.xml` declare the `INTERNET` permission only and carry neither
  attribute, which is correct: the manifest merger takes the `<application>` attributes from
  `src/main`, and neither variant file overrides them.

- `ios/Runner/Info.plist:69-73`:

  ```xml
  <key>NSAppTransportSecurity</key>
  <dict>
  	<key>NSAllowsArbitraryLoads</key>
  	<true/>
  </dict>
  ```

  The dict holds that one key. No `NSExceptionDomains`, no `NSAllowsLocalNetworking`. The file uses
  tab indentation.

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
  `<domain-config>` element. `docs/api/connectivity.md:72-110` records the decision: a build-time file
  cannot name a host the human types at runtime, so scoping and arbitrary-host support are mutually
  exclusive.
- The script greps and nothing else. It runs no build, boots no device and asserts no enforcement.
- **The script is a shell file with a comment block, and that is correct.** `scripts/arch-check.sh`
  scans `*.dart` under `lib/` only, so the comment ban does not reach it.
- The script gets no `scripts/platform-config-check.test.sh`. `scripts/*.test.sh` is denied to every
  role at `scripts/lane-check.sh:38-40`, and `Makefile:123-127` names each `pipeline-test` entry
  explicitly, so a new self-test would be neither writable nor run. The EPIC Proof calls the script
  directly.
- The script touches no desktop and no web target. Neither has a cleartext policy.
- Do not add the script to `make verify`. `Makefile:129` is locked to every role, and the EPIC Proof
  invokes the script on its own line.

## Tasks

### Task 009.1 — the platform config check

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
  proves the declaration and nothing else. Read `docs/api/connectivity.md:107-110`.
- Proof: `PASS 002-G10-PLATFORM`.
