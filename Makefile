.DEFAULT_GOAL := help

ifeq ($(OS),Windows_NT)
	HOST := windows
	FVM_FOUND := $(shell where fvm 2>NUL)
	NODE_FOUND := $(shell where node 2>NUL)
else
	UNAME_S := $(shell uname -s)
	ifeq ($(UNAME_S),Darwin)
		HOST := macos
	else
		HOST := linux
	endif
	FVM_FOUND := $(shell command -v fvm 2>/dev/null)
	NODE_FOUND := $(shell command -v node 2>/dev/null)
endif

ifeq ($(FVM_FOUND),)
	FLUTTER := flutter
	DART := dart
else
	FLUTTER := fvm flutter
	DART := fvm dart
endif

DART_SOURCES = $(shell find lib test -name '*.dart' \
	! -name '*.g.dart' ! -name '*.freezed.dart' \
	! -name '*.mocks.dart' ! -name '*.gen.dart')

.PHONY: help bootstrap generate generate-lib generate-test format format-check \
	analyze arch-check test test-one pipeline-test verify clean \
	dev run-ios run-android run-macos run-windows run-linux run-web

# The development host is Chrome. The daemon matches an origin exactly, so the
# port is pinned and never random. Read docs/api/connectivity.md.
WEB_PORT ?= 8080
WEB_ORIGIN := http://localhost:$(WEB_PORT)

help:
	@echo "Kanthord targets (host: $(HOST), flutter: $(FLUTTER))"
	@echo ""
	@echo "  bootstrap     Install the Flutter SDK, the Dart packages, and the commit hooks"
	@echo "  generate      Run build_runner one time over lib/ and test/"
	@echo "  generate-lib  Run build_runner over lib/ only. The software-engineer lane"
	@echo "  generate-test Run build_runner over test/ only. The test-engineer lane"
	@echo "  format        Rewrite every Dart, Markdown, YAML and JSON file to the project format"
	@echo "  format-check  Fail when a file is not formatted. Run it before you push"
	@echo "  analyze       Run the static analyzer"
	@echo "  test          Run the Flutter test suite"
	@echo "  test-one      Run one test file: make test-one T=<path>"
	@echo "  arch-check    Check the mechanical CLAUDE.md and DESIGNS.md rules over lib/"
	@echo "  pipeline-test Run the TDD pipeline guard self-tests"
	@echo "  verify        The full gate: format-check, analyze, arch-check, test, pipeline-test"
	@echo "  clean         Delete the build output and the generated files"
	@echo ""
	@echo "  run-ios       Run on an iOS simulator"
	@echo "  run-android   Run on an Android emulator"
	@echo "  run-macos     Run on macOS"
	@echo "  run-windows   Run on Windows"
	@echo "  run-linux     Run on Linux"
	@echo "  run-web       Run on Chrome at $(WEB_ORIGIN). The development host"
	@echo "  dev           Alias for run-web. The default development loop"

bootstrap:
ifeq ($(FVM_FOUND),)
	@echo "fvm is not installed. Install it, then run make bootstrap again."
ifeq ($(HOST),macos)
	@echo "  brew tap leoafarias/fvm && brew install fvm"
else ifeq ($(HOST),linux)
	@echo "  curl -fsSL https://fvm.app/install.sh | bash"
else
	@echo "  choco install fvm"
endif
	@exit 1
else
	fvm install
endif
	$(FLUTTER) pub get
ifeq ($(NODE_FOUND),)
	@echo "node is not installed. Skipping the commit hook setup."
	@echo "Commit linting stays optional. Install Node to enable it."
else
	npm ci
endif

generate:
	$(DART) run build_runner build

generate-lib:
	$(DART) run build_runner build --build-filter "lib/**"

generate-test:
	$(DART) run build_runner build --build-filter "test/**"

format:
	$(DART) format $(DART_SOURCES)
ifeq ($(NODE_FOUND),)
	@echo "node is not installed. Skipping the markdown, YAML and JSON format."
else
	npm run format
endif

format-check:
	$(DART) format --output=none --set-exit-if-changed $(DART_SOURCES)
ifeq ($(NODE_FOUND),)
	@echo "node is not installed. Skipping the markdown, YAML and JSON check."
else
	npm run format:check
endif

analyze:
	$(FLUTTER) analyze

test:
	$(FLUTTER) test

test-one:
	$(FLUTTER) test $(T)

arch-check:
	scripts/arch-check.sh

pipeline-test:
	scripts/lane-check.test.sh
	scripts/turn-snapshot.test.sh
	scripts/memory-append-only.test.sh
	scripts/arch-check.test.sh

verify: format-check analyze arch-check test pipeline-test

clean:
	$(FLUTTER) clean
	$(DART) run build_runner clean

run-ios:
	$(FLUTTER) run -d ios

run-android:
	$(FLUTTER) run -d android

run-macos:
	$(FLUTTER) run -d macos

run-windows:
	$(FLUTTER) run -d windows

run-linux:
	$(FLUTTER) run -d linux

# dev is the default development loop: Chrome at the pinned port, no simulator
# and no emulator. The daemon needs KANTHORD_HTTP_ALLOWED_ORIGINS=$(WEB_ORIGIN).
dev: run-web

run-web:
	@echo "origin: $(WEB_ORIGIN)  (the daemon must allow it)"
	$(FLUTTER) run -d chrome --web-port=$(WEB_PORT) --web-hostname=localhost
