#!/bin/bash
set -e

echo "Starting local pipeline reproduction..."

if [ -z "$DOCS_PLATFORM_NPM_TOKEN" ]; then
  echo "Error: DOCS_PLATFORM_NPM_TOKEN is not set."
  exit 1
fi

# 1. Setup npm
echo "Configuring npm..."
npm config set @ascertia-integrations:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken "$DOCS_PLATFORM_NPM_TOKEN"

# 2. Go to client repo
cd /workspace/client

# 3. Install dependencies (using npm install as the client does)
echo "Installing dependencies in client repo..."
npm install

# 4. Simulate the sync step
# We assume we want to sync version 1.0.0
VERSION="1.0.0"
echo "Simulating sync for version $VERSION..."

# Note: In CI, we fetch the branch first. Here we assume the branch exists locally or in the mounted /workspace/client
# Run the sync command (the one I just fixed in the POC repo)
# We use the sync tool from the POC repo directly to test the local changes
echo "Building the sync tool in POC repo..."
cd /workspace/poc
npm install
npm run build

echo "Running the sync tool..."
cd /workspace/client
# Use the local build of the tool
node /workspace/poc/packages/docusaurus-version-sync/bin/docusaurus-sync-version.js "$VERSION" --allow-dirty --docs-dir docs

echo "Building docusaurus..."
npm run build

echo "Reproduction successful!"
