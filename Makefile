.PHONY: help dev build smoke sbom clean test lint

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start development server
	npm run dev

build: ## Build the application
	npm run build

smoke: ## Run fast local self-test (build + SBOM + provenance + cosign dry-run)
	@echo "🚀 Running smoke test..."
	@bash scripts/smoke.sh

sbom: ## Generate SBOM only
	@echo "📦 Generating SBOM..."
	@bash scripts/generate-cyclonedx-sbom.sh

clean: ## Clean build artifacts
	@echo "🧹 Cleaning..."
	@rm -rf dist build artifacts/*.tar.gz artifacts/*.sha256 artifacts/*.json
	@echo "✅ Clean complete"

test: ## Run tests
	npm test

lint: ## Run linter
	npm run lint || npx eslint .

install: ## Install dependencies with lockfile verification
	@node scripts/verify-lockfile.js
	@npm ci --prefer-offline --no-audit
