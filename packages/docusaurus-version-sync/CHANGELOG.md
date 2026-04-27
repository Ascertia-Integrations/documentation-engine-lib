# @ascertia-integrations/docusaurus-version-sync

## 0.1.10

### Patch Changes

- 96b2519: Rewrite GitBook image references during version sync by copying referenced assets beside each synced doc and converting `img` sources to MDX imports before versioning.

## 0.1.9

### Patch Changes

- eb3d3fa: Add a `--remove` mode to prune deleted release versions from generated
  Docusaurus artifacts so GitHub Pages deployments can remove orphaned version
  pages when a release branch is deleted.

## 0.1.8

### Patch Changes

- 2ace7b2: fix: change tar import syntax to commonjs style to resolve runtime undefined error

## 0.1.7

### Patch Changes

- d3fa1b2: Add @types/tar to fix TypeScript compilation error.

## 0.1.6

### Patch Changes

- dcd587d: Fix tar import in version sync tool to resolve "Cannot read properties of undefined (reading 'x')" error.

## 0.1.2

### Patch Changes

- Fix reusable workflow npm config step for npm 10.x by removing unsupported `npm config set always-auth` usage.

## 0.1.1

### Patch Changes

- Improve reusable workflow ergonomics: support configurable install command and safer concurrency.

## 0.1.0

### Minor Changes

- Initial publish of the docs platform preset and version-sync CLI for consumer repositories.
