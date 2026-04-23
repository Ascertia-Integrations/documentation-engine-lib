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

## Reusable workflow access (GitHub setting)

If this platform repo is private, GitHub must allow other repos to call its reusable workflows.

- In `docusaurus-github-pages-poc` repo settings: **Actions → General → Access** → allow **All repositories in the organization** (or the specific consumer repos).

## Consumer repo requirements

A consumer (product) documentation repository should implement:

- **Docusaurus site** with `docs/`, `docusaurus.config.ts`, `sidebars.ts`, `package.json`.
- **Versioned artifacts (CI-managed, committed to the consumer repo default branch)**:
  - `versions.json`
  - `versioned_docs/`
  - `versioned_sidebars/`
- **Dependencies**:
  - `@ascertia-integrations/docusaurus-preset-docs` (The pipeline automatically forces updates to the latest version of this preset during the build, so you rarely need to manually bump it in `package.json`).
  - *Note: You do NOT need to include `@ascertia-integrations/docusaurus-version-sync` as a dependency. The pipeline uses `npx --yes` to dynamically fetch the absolute latest version at runtime.*
- **GitHub Packages npm config** (example `.npmrc`):
  ```ini
  @ascertia-integrations:registry=https://npm.pkg.github.com
  ```
- **GitHub Pages**: enable GitHub Pages for the repository in **Settings → Pages** and set the source to **GitHub Actions**.
- **CI secret**: set `DOCS_PLATFORM_NPM_TOKEN` to a PAT that includes **`read:packages`** (and can access private packages). If the packages are private/repo-scoped, a classic PAT typically also needs **`repo`**. Pass the secret to the reusable workflow (for example via `secrets: inherit`).
- **Docusaurus navbar**: the shared preset injects the version dropdown automatically and shows released versions by default. Consumer repos only need to configure it if they want custom placement or behavior.
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
    secrets: inherit
    permissions:
      contents: write
      pages: write
      id-token: write
```

Notes:
- On pushes to `X.Y.Z` branches, the workflow runs `docusaurus-sync-version X.Y.Z`, commits `versions.json` / `versioned_*` to `main`, then builds and deploys.
- If your repo does not use `docs/` or `sidebars.ts`, override `sync_command` to pass `--docs-dir` / `--sidebar-path`.
- If your repo’s lockfile frequently changes or you’re bootstrapping a new repo, override `install_command` to `npm install` instead of `npm ci`.

### The "Zero-Maintenance" Architecture
The pipeline is designed so that documentation authors **only need to write Markdown**. They do not need to worry about updating NPM packages or lockfiles when the platform tools change.
- The pipeline explicitly runs `npm install @ascertia-integrations/docusaurus-preset-docs@latest` to auto-inject the latest CSS and layout components.
- The pipeline executes `npx --yes @ascertia-integrations/docusaurus-version-sync@latest` to guarantee it runs the most up-to-date version syncing logic, ignoring local project lockfiles.

## Critical Configuration & Troubleshooting

### 1. GitHub Pages Environment (Required)
If your deployment fails when running from a version branch such as `1.0.0` or `2.0.6`, check the `github-pages` environment first.

That error usually means the workflow is trying to deploy to the `github-pages` environment, but that environment only allows deployments from specific branches and the current release branch is not allowed. GitHub environments can enforce branch restrictions, required approvals, delays, and other deployment protection rules. GitHub Pages custom workflows use the `github-pages` environment by default, so the deploy job must satisfy those rules before deployment is allowed.

What to check:

- Go to **Settings → Environments → `github-pages`**.
- Review **Deployment branches and tags** or any branch restriction rules.
- If the environment is limited to `main` or `master`, a workflow running from `1.0.0`, `2.0.6`, or another release branch will be blocked.

Choose the behavior you want:

- Deploy only from `main`: keep the environment restriction and make sure the Pages deploy workflow only runs on `main`.
- Allow release branches to deploy: add the relevant release branch names or patterns such as `*.*.*` to the allowed branches and tags for the `github-pages` environment.
- Use tags or releases instead of branch deploys: update the environment rule to match that release process.

### 2. Permissions & Secrets
- **`DOCS_PLATFORM_NPM_TOKEN`**: Must be a PAT with `read:packages` scope.
- **Workflow Permissions**: The calling workflow MUST have `contents: write` and `pages: write` permissions.

### 3. CLI Argument Order
When overriding the `sync_command`, ensure the **version number** is the first argument after the command name:
- ✅ `npx docusaurus-sync-version 1.0.0 --allow-dirty`
- ❌ `npx docusaurus-sync-version --allow-dirty 1.0.0` (May fail in older versions of the tool).

### 4. Publishing New Versions
To update the platform tools (like the sync CLI):
1. Bump the version in `packages/docusaurus-version-sync/package.json`.
2. Push to `main`.
3. The **"Publish Package"** workflow will automatically build and publish to GitHub Packages.
