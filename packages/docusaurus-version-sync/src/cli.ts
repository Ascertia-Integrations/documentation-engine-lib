import path from "node:path";
import { syncVersionFromGitRef } from "./sync";

function getArgValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function usage(): string {
  return [
    "Usage:",
    "  docusaurus-sync-version <X.Y.Z> [options]",
    "",
    "Options:",
    "  --site-dir <path>        Docusaurus site directory (default: .)",
    "  --docs-dir <path>        Docs directory (default: docs)",
    "  --sidebar-path <path>    Sidebar file path (default: sidebars.ts)",
    "  --git-ref <ref>          Git ref/branch to export (default: <X.Y.Z>)",
    "  --allow-dirty            Allow dirty working tree (default: false)",
    "  --dry-run                Validate only; no changes (default: false)",
  ].join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const version = args[0];
  if (!version || version.startsWith("-")) {
    // eslint-disable-next-line no-console
    console.error(usage());
    process.exit(2);
    return;
  }

  const siteDir = getArgValue(args, "--site-dir") ?? ".";
  const docsDir = getArgValue(args, "--docs-dir") ?? "docs";
  const sidebarPath = getArgValue(args, "--sidebar-path") ?? "sidebars.ts";
  const gitRef = getArgValue(args, "--git-ref") ?? version;
  const allowDirty = hasFlag(args, "--allow-dirty");
  const dryRun = hasFlag(args, "--dry-run");

  await syncVersionFromGitRef({
    siteDir: path.resolve(siteDir),
    docsDir,
    sidebarPath,
    gitRef,
    version,
    allowDirty,
    dryRun,
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.message.includes("Working tree is dirty")) {
    console.error("\nTip: This usually happens in CI when dependencies are installed or config is modified.");
    console.error("Use the --allow-dirty flag to proceed anyway.");
  }
  process.exit(1);
});
