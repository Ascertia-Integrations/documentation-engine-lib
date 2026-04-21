# Docs Platform (Docusaurus)

This repository is intended to be a **platform/tooling** repo that other product documentation repositories consume.

It provides:
- A shared Docusaurus preset/theme package.
- A version-sync CLI that maps `X.Y.Z` release branches into Docusaurus versioned docs.
- A reusable GitHub Actions workflow for building + deploying product docs to GitHub Pages.

## Packages

- `@ascertia-integrations/docusaurus-preset-docs`
- `@ascertia-integrations/docusaurus-version-sync` (CLI: `docusaurus-sync-version`)

## Reusable workflow

Product repos can call:

```yaml
uses: Ascertia-Integrations/docusaurus-github-pages-poc/.github/workflows/reusable-deploy-docs.yml@vX.Y.Z
```

## Consumer repo requirements

A consumer (product) documentation repository should implement:

- **Docusaurus site** with `docs/`, `docusaurus.config.ts`, `sidebars.ts`, `package.json`.
- **Versioned artifacts (CI-managed, committed to the consumer repo default branch)**:
  - `versions.json`
  - `versioned_docs/`
  - `versioned_sidebars/`
- **Dependencies**:
  - `@ascertia-integrations/docusaurus-preset-docs`
  - `@ascertia-integrations/docusaurus-version-sync` (CLI: `docusaurus-sync-version`)
- **GitHub Packages npm config** (example `.npmrc`):
  ```ini
  @ascertia-integrations:registry=https://npm.pkg.github.com
  ```
- **Docusaurus navbar** includes the version dropdown:
  ```ts
  { type: "docsVersionDropdown", position: "right" }
  ```
- **Pages-safe URL defaults** in `docusaurus.config.ts`:
  ```ts
  const url = process.env.SITE_URL ?? "http://localhost:3000";
  const baseUrl = process.env.BASE_URL ?? "/";
  ```
- **Build output** goes to `build/` (or override `build_command` / adjust workflow if your output differs).

### Consumer workflow example

In the consumer repo, add a workflow that calls the reusable workflow (adjust the `@vX.Y.Z` tag):

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

Notes:
- On pushes to `X.Y.Z` branches, the workflow runs `docusaurus-sync-version X.Y.Z`, commits `versions.json` / `versioned_*` to `main`, then builds and deploys.
- If your repo does not use `docs/` or `sidebars.ts`, override `sync_command` to pass `--docs-dir` / `--sidebar-path`.
