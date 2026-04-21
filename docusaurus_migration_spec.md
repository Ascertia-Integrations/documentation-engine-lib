# Technical Specification

**Branch-driven Docusaurus documentation platform on GitHub Pages**

**Status:** Proposed  
**Owner:** Documentation Platform / Engineering  
**Scope:** Multiple product documentation repositories with shared theme and version dropdowns

## Decision

- **Use one Docusaurus site per product repository**, backed by a shared theme/preset package.
- **Version source of truth:** Git branches named `X.Y.Z` remain maintenance branches; CI synchronizes them into Docusaurus published versions.
- **Hosting:** GitHub Pages, deployed via GitHub Actions.
- **Expected behavior:** A push to a version branch republishes that version of the docs and keeps the Docusaurus version dropdown up to date.

## 1. Purpose

This specification defines the target architecture, repository standards, deployment workflows, and acceptance criteria for migrating product documentation from GitBook to Docusaurus.

The design must satisfy two functional requirements:

1. Multiple documentation repositories, one per product, must share a common look and feel.
2. Each repository uses release-maintenance branches named `X.Y.Z`, and each version must appear in a version dropdown in the published documentation site.

## 2. Goals and non-goals

### 2.1 Goals

- Provide a consistent branded documentation experience across all product sites.
- Allow product teams to continue using separate repositories and maintenance branches.
- Publish versioned documentation with a native Docusaurus version dropdown.
- Update a published version automatically when its corresponding `X.Y.Z` branch changes.
- Host the generated sites on GitHub Pages using GitHub Actions.

### 2.2 Non-goals

- Create a single cross-product documentation portal in the initial phase.
- Serve documentation directly from arbitrary Git branches at runtime.
- Preserve GitBook-specific plugins, syntax, or navigation semantics unless explicitly migrated.

## 3. Target architecture

Each product repository becomes an independent Docusaurus site. All sites consume a shared internal theme or preset package for common styling, navbar/footer structure, and optional shared components.

A GitHub Actions workflow runs in each product repository. The workflow detects whether a push occurred on the default branch or on a release-maintenance branch named `X.Y.Z`.

For version branches, the workflow rebuilds the Docusaurus `versioned_docs` content for that exact version, updates `versions.json` as required, builds the static site, and deploys the result to GitHub Pages.

### 3.1 Component model

| Component | Responsibility | Ownership | Notes |
|---|---|---|---|
| Product docs repo | Holds Markdown, sidebars, site config, and workflow. | Product team | One repo per product. |
| Shared theme/preset package | Centralizes CSS, layout, navbar/footer, MDX components, analytics hooks. | Platform team | Versioned as an internal npm package or GitHub package. |
| Version sync script | Maps Git branch content into Docusaurus `versioned_docs` and `versions.json`. | Platform team | Can be reused by all product repos. |
| GitHub Actions workflow | Builds and deploys the static site to Pages. | Product team with platform template | Triggered on `main` and `X.Y.Z` branches. |
| GitHub Pages | Hosts the built static site. | GitHub | Public or internal depending on repository visibility. |

## 4. Repository structure

Each product repository should conform to the following baseline structure:

```text
product-a-docs/
  docs/
  src/
  static/
  docusaurus.config.ts
  sidebars.ts
  package.json
  versions.json                 # generated/managed by workflow
  versioned_docs/               # generated/managed by workflow
  versioned_sidebars/           # generated/managed by workflow
  scripts/sync-version-from-branch.ts
  .github/workflows/deploy-docs.yml
```

### 4.1 Branch conventions

- `main` is the integration branch for current documentation work.
- Branches matching `^\d+\.\d+\.\d+$` are treated as released documentation versions.
- Only branches that match the release pattern are eligible to become published entries in the Docusaurus version dropdown.
- Branch names must map exactly to the version label shown in the dropdown.

## 5. Styling strategy

All product sites must consume a shared package, for example `@company/docusaurus-preset-docs`. The package contains the baseline theme configuration, shared CSS tokens, optional React components, and any common navbar/footer items.

Product repositories may override logos, product names, and product-specific navigation, but they must not fork the core styling package unless approved by the platform owner.

### 5.1 Shared preset contents

- Typography, color tokens, spacing rules, code block styling, admonition styling.
- Common navbar/footer shell and documentation information architecture patterns.
- SEO defaults, analytics hooks, favicon handling, and optional search integration points.
- Reusable MDX components such as badges, callouts, feature lists, and release metadata blocks.

## 6. Versioning model

Docusaurus versioning is the presentation model. Git branches are the maintenance model. The workflow bridges the two.

The workflow must treat each `X.Y.Z` branch as the source of truth for that released version. On every qualifying push, it checks out the branch content, regenerates the corresponding `versioned_docs/version-X.Y.Z` content, updates `versioned_sidebars`, ensures `versions.json` contains the version, and rebuilds the site.

The current `docs/` directory on `main` continues to represent the unreleased or next version.

### 6.1 Required navbar configuration

```ts
navbar: {
  items: [
    { type: 'docsVersionDropdown', position: 'right' },
  ],
}
```

### 6.2 Version publication rules

| Trigger | System behavior |
|---|---|
| Push to `main` | Build current site. Do not create a new release version automatically. |
| Push to `X.Y.Z` branch | Republish only version `X.Y.Z` from that branch's content. |
| First publication of a new `X.Y.Z` branch | Create version entry if missing, then build/deploy. |
| Subsequent publication of existing `X.Y.Z` branch | Replace the generated content for version `X.Y.Z` and redeploy. |
| Branch deletion | No automatic version removal unless explicitly implemented as an administrative action. |

## 7. CI/CD workflow

The site must be deployed through GitHub Actions to GitHub Pages.

The workflow should be reusable across product repositories via a reusable workflow or shared action where practical.

### 7.1 Workflow steps

1. Trigger on push to `main` and on push to branches matching the `X.Y.Z` pattern.
2. Checkout repository history with sufficient depth to inspect the triggering branch.
3. Install Node.js and dependencies.
4. Determine whether the build is for `main` or for a release branch.
5. If building a release branch, run the sync script for the target version.
6. Run Docusaurus build.
7. Upload the build artifact.
8. Deploy to GitHub Pages.

### 7.2 Sync script responsibilities

- Validate that the branch name matches SemVer-like `X.Y.Z`.
- Checkout or read the branch content to a temporary working directory.
- Copy docs content into `versioned_docs/version-X.Y.Z`.
- Generate or refresh the `version-X.Y.Z` sidebar file in `versioned_sidebars`.
- Insert `X.Y.Z` into `versions.json` if absent, without duplicating entries.
- Optionally mark the highest release version as latest according to team policy.

### 7.3 Illustrative workflow skeleton

```yaml
name: deploy-docs
on:
  push:
    branches:
      - main
      - '*.*.*'
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: node scripts/sync-version-from-branch.js
        if: github.ref_name != 'main'
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build
      - uses: actions/deploy-pages@v4
```

## 8. Configuration standards

| Area | Required standard | Rationale |
|---|---|---|
| Docusaurus version | Pin a supported major/minor across all repos. | Avoid fragmented behavior across product sites. |
| Node.js runtime | Standardize one LTS runtime in all workflows. | Reduce pipeline drift. |
| Theme package | Reference a shared package version, not copied assets. | Centralized styling and controlled upgrades. |
| Sidebar organization | Keep consistent section ordering and labeling patterns. | Improves cross-product usability. |
| Docs root | Use `docs/` for current development content. | Matches Docusaurus expectations. |

## 9. Migration plan

| Milestone | Deliverable |
|---|---|
| M1. Platform baseline | Create shared Docusaurus preset/theme package and reference implementation repo. |
| M2. First product migration | Migrate one product from GitBook, including one release branch and one current branch. |
| M3. Branch-sync automation | Implement and harden the branch-to-version synchronization workflow. |
| M4. Shared rollout | Adopt the preset and workflow template across remaining product repositories. |
| M5. Operationalization | Document release/update procedures and ownership for ongoing maintenance. |

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Branch-to-version drift | Published version does not reflect the latest branch state. | Make the sync workflow the only supported publication path; add CI validation. |
| Theme divergence | Teams override shared styling inconsistently. | Enforce shared preset usage and restrict overrides to approved extension points. |
| Large maintenance matrix | Many active versions increase build time and complexity. | Limit supported versions per product and archive obsolete branches. |
| Broken version dropdown | `versions.json` or generated sidebars become inconsistent. | Add automated checks before build and fail fast on invalid state. |

## 11. Acceptance criteria

- A product repository can build and deploy a Docusaurus site to GitHub Pages.
- Two or more product repositories can consume the same shared theme/preset and render the same core styling.
- A push to a branch named `X.Y.Z` republishes that version and leaves other versions intact.
- The published site shows a Docusaurus version dropdown containing all supported `X.Y.Z` versions for that product.
- A push to `main` updates only the current development docs and does not unintentionally overwrite a released version.
- The deployment process is reproducible from CI without manual file editing in `versioned_docs` or `versions.json`.

## 12. Open decisions

- Whether to keep one site per product indefinitely or later consolidate into a central portal.
- How many historic versions each product must continue to publish.
- Whether version retirement should be branch-deletion-driven or managed through an explicit administrative configuration.
- Whether search should be local only or integrated with a shared documentation search provider.

## 13. Appendix A: implementation notes

- The shared preset can be distributed through GitHub Packages or an internal npm registry.
- The sync script can be implemented in Node.js so it can inspect the filesystem and generate version metadata without shell-specific dependencies.
- Where exact reproducibility matters, the sync script should sort version entries deterministically, for example by semantic version order descending.
