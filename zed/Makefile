.PHONY: help release patch minor major build clean

help:
	@echo "Available commands:"
	@echo "  make release       - Create new release (auto-increment patch version)"
	@echo "  make patch         - Increment patch version (1.0.1 -> 1.0.2)"
	@echo "  make minor         - Increment minor version (1.0.1 -> 1.1.0)"
	@echo "  make major         - Increment major version (1.0.1 -> 2.0.0)"
	@echo "  make build         - Build the extension"
	@echo "  make clean         - Clean build artifacts"

# Get current version from extension.toml
VERSION := $(shell grep '^version = ' extension.toml | sed 's/version = "\(.*\)"/\1/')

# Parse version components
MAJOR := $(shell echo $(VERSION) | cut -d. -f1)
MINOR := $(shell echo $(VERSION) | cut -d. -f2)
PATCH := $(shell echo $(VERSION) | cut -d. -f3)

# Calculate new versions
NEW_PATCH := $(MAJOR).$(MINOR).$(shell echo $$(($(PATCH) + 1)))
NEW_MINOR := $(MAJOR).$(shell echo $$(($(MINOR) + 1))).0
NEW_MAJOR := $(shell echo $$(($(MAJOR) + 1))).0.0

patch:
	@echo "Current version: $(VERSION)"
	@echo "New version: $(NEW_PATCH)"
	@sed -i '' 's/version = "$(VERSION)"/version = "$(NEW_PATCH)"/' extension.toml
	@echo "Version updated to $(NEW_PATCH) in extension.toml"

minor:
	@echo "Current version: $(VERSION)"
	@echo "New version: $(NEW_MINOR)"
	@sed -i '' 's/version = "$(VERSION)"/version = "$(NEW_MINOR)"/' extension.toml
	@echo "Version updated to $(NEW_MINOR) in extension.toml"

major:
	@echo "Current version: $(VERSION)"
	@echo "New version: $(NEW_MAJOR)"
	@sed -i '' 's/version = "$(VERSION)"/version = "$(NEW_MAJOR)"/' extension.toml
	@echo "Version updated to $(NEW_MAJOR) in extension.toml"

release: patch
	@echo "Creating release v$(NEW_PATCH)..."
	@git add extension.toml
	@git commit -m "Bump version to $(NEW_PATCH)"
	@git tag -a "v$(NEW_PATCH)" -m "Release v$(NEW_PATCH)"
	@echo "Release v$(NEW_PATCH) created!"
	@echo "To push: git push origin master && git push origin v$(NEW_PATCH)"
	@echo ""
	@echo "Or run: make push"

push:
	@echo "Pushing changes and tags to origin..."
	@git push origin master
	@git push origin --tags
	@echo "Done!"

build:
	@echo "Building extension..."
	@cargo build --release
	@echo "Build complete!"

clean:
	@echo "Cleaning build artifacts..."
	@cargo clean
	@rm -f extension.wasm
	@echo "Clean complete!"
