# Product repo setup (consumer)

This file describes the expected contract for a product documentation repository that consumes this platform repo.

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

## Docusaurus config requirements

Ensure the navbar contains the version dropdown:

```ts
{ type: "docsVersionDropdown", position: "right" }
```

Compute Pages-safe URL defaults:

- `url`: `process.env.SITE_URL ?? "http://localhost:3000"`
- `baseUrl`: `process.env.BASE_URL ?? "/"`

## GitHub Actions

In the product repo, add a workflow that calls the reusable workflow:

```yaml
name: deploy-docs
on:
  push:
    branches:
      - main
      - "*.*.*"
jobs:
  deploy:
    uses: Ascertia-Integrations/docusaurus-github-pages-poc/.github/workflows/reusable-deploy-docs.yml@vX.Y.Z
    permissions:
      contents: write
      pages: write
      id-token: write
```

