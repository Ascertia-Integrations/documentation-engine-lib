# Product repo setup (consumer)

This file describes the expected contract for a product documentation repository that consumes this Documentation Engine library repo.

## Dependencies

In the product repo:

- Install:
  - `@ascertia-integrations/docusaurus-preset-docs`
  - `@ascertia-integrations/docusaurus-version-sync`

## npm registry config

If you use npm, ensure you can install from GitHub Packages:

Add `.npmrc`:

```ini
@ascertia-integrations:registry=https://npm.pkg.github.com
```

GitHub Actions uses `GITHUB_TOKEN` for auth in the reusable workflow.
For cross-repo installs from GitHub Packages, create a repo (or org) secret named `DOCS_PLATFORM_NPM_TOKEN` containing a PAT that includes **`read:packages`** and can access private packages. If the packages are private/repo-scoped, a classic PAT typically also needs **`repo`**. The consumer workflow should pass it to the reusable workflow (for example via `secrets: inherit`).

## Docusaurus config requirements

The shared preset injects the version dropdown automatically and shows released
versions by default. Consumer repos do not need to add
`docsVersionDropdown` manually unless they want to override its placement or
behavior.

Compute Pages-safe URL defaults:

- `url`: `process.env.SITE_URL ?? "http://localhost:3000"`
- `baseUrl`: `process.env.BASE_URL ?? "/"`

## GitHub Actions

In the product repo, add a workflow that calls the reusable workflow:

```yaml
name: deploy-docs
on:
  workflow_dispatch:
  push:
    branches:
      - main
      - "*.*.*"
  delete:
jobs:
  deploy:
    if: ${{ github.event_name != 'delete' }}
    uses: Ascertia-Integrations/documentation-engine-lib/.github/workflows/reusable-deploy-docs.yml@vX.Y.Z
    secrets: inherit
    with:
      # Use `npm ci` if your lockfile is stable; use `npm install` when bootstrapping.
      install_command: npm ci
    permissions:
      contents: write
      pages: write
      id-token: write

  prune-deleted-release:
    if: ${{ github.event_name == 'delete' && github.event.ref_type == 'branch' }}
    uses: Ascertia-Integrations/documentation-engine-lib/.github/workflows/reusable-deploy-docs.yml@vX.Y.Z
    secrets: inherit
    with:
      install_command: npm ci
      release_action: prune
      release_ref: ${{ github.event.ref }}
    permissions:
      contents: write
      pages: write
      id-token: write
```

When an `X.Y.Z` release branch is deleted, the delete-triggered job prunes the
corresponding generated version artifacts from `main`, rebuilds the site, and
redeploys GitHub Pages so orphaned version URLs disappear.

## Platform repo configuration (reusable workflow access)

If `documentation-engine-lib` is private, ensure GitHub allows other repos to reuse its workflows:

- In the platform repo settings: **Actions → General → Access** → allow reuse by the organization (or selected repositories).
