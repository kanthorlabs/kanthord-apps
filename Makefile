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

.PHONY: help bootstrap generate format format-check analyze test clean \
	run-ios run-android run-macos run-windows run-linux run-web

help:
	@echo "Kanthord targets (host: $(HOST), flutter: $(FLUTTER))"
	@echo ""
	@echo "  bootstrap     Install the Flutter SDK, the Dart packages, and the commit hooks"
	@echo "  generate      Run build_runner one time"
	@echo "  format        Rewrite every Dart file to the project format"
	@echo "  format-check  Fail when a Dart file is not formatted. Run it before you push"
	@echo "  analyze       Run the static analyzer"
	@echo "  test          Run the Flutter test suite"
	@echo "  clean         Delete the build output and the generated files"
	@echo ""
	@echo "  run-ios       Run on an iOS simulator"
	@echo "  run-android   Run on an Android emulator"
	@echo "  run-macos     Run on macOS"
	@echo "  run-windows   Run on Windows"
	@echo "  run-linux     Run on Linux"
	@echo "  run-web       Run on Chrome"

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

format:
	$(DART) format .

format-check:
	$(DART) format --output=none --set-exit-if-changed .

analyze:
	$(FLUTTER) analyze

test:
	$(FLUTTER) test

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

run-web:
	$(FLUTTER) run -d chrome
