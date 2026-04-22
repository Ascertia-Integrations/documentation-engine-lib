import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { x as extract } from "tar";
import { execGit } from "./git";
import { isPlainSemver, sortVersionsDesc } from "./versions";

export type SyncOptions = {
  siteDir: string;
  docsDir: string;
  sidebarPath: string;
  gitRef: string;
  version: string;
  allowDirty: boolean;
  dryRun: boolean;
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonArray(filePath: string): Promise<string[] | null> {
  if (!(await pathExists(filePath))) return null;
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
    throw new Error(`${filePath} must be a JSON array of strings`);
  }
  return parsed;
}

async function writeJsonArray(filePath: string, values: string[]): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
}

async function removeIfExists(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
}

function findLocalDocusaurusBin(siteDir: string): string {
  const binName = process.platform === "win32" ? "docusaurus.cmd" : "docusaurus";
  const candidate = path.join(siteDir, "node_modules", ".bin", binName);
  return candidate;
}

async function runCommand(
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...(opts.env ?? {}) }, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`${cmd} ${args.join(" ")} failed (code ${code})`));
      else resolve();
    });
  });
}

async function exportPathsFromGitRef(params: {
  repoRoot: string;
  gitRef: string;
  paths: string[];
  destDir: string;
}): Promise<void> {
  const git = spawn("git", ["archive", params.gitRef, "--format=tar", "--", ...params.paths], {
      cwd: params.repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

  let stderr = "";
  git.stderr.setEncoding("utf8");
  git.stderr.on("data", (chunk) => (stderr += chunk));

  const exitCodePromise = new Promise<number>((resolve, reject) => {
    git.on("error", reject);
    git.on("close", (code) => resolve(code ?? 0));
  });

  try {
    await pipeline(git.stdout, extract({ cwd: params.destDir }));
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    throw new Error(`git archive extract failed for ${params.gitRef}\n${stderr}\n${e.message}`.trim());
  }

  const exitCode = await exitCodePromise;
  if (exitCode !== 0) {
    throw new Error(`git archive failed for ${params.gitRef} (code ${exitCode})\n${stderr}`.trim());
  }
}

export async function syncVersionFromGitRef(options: SyncOptions): Promise<void> {
  if (!isPlainSemver(options.version)) {
    throw new Error(`Version must match X.Y.Z, got: ${options.version}`);
  }

  const siteDir = path.resolve(options.siteDir);
  const { stdout: repoRootOut } = await execGit(["rev-parse", "--show-toplevel"], { cwd: siteDir });
  const repoRoot = repoRootOut.trim();

  if (!options.allowDirty) {
    const { stdout } = await execGit(["status", "--porcelain"], { cwd: siteDir });
    if (stdout.trim().length > 0) {
      throw new Error("Working tree is dirty. Commit/stash changes or use --allow-dirty.");
    }
  }

  let resolvedGitRef = options.gitRef;
  try {
    await execGit(["rev-parse", "--verify", `${resolvedGitRef}^{commit}`], { cwd: repoRoot });
  } catch {
    const originCandidate = `origin/${options.gitRef}`;
    await execGit(["rev-parse", "--verify", `${originCandidate}^{commit}`], { cwd: repoRoot });
    resolvedGitRef = originCandidate;
  }

  if (options.dryRun) return;

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "docusaurus-version-sync-"));
  const exportDir = path.join(tmpRoot, "export");
  const backupDir = path.join(tmpRoot, "backup");
  await fs.mkdir(exportDir, { recursive: true });
  await fs.mkdir(backupDir, { recursive: true });

  const repoDocsDir = path.join(siteDir, options.docsDir);
  const repoSidebarPath = path.join(siteDir, options.sidebarPath);
  const versionsPath = path.join(siteDir, "versions.json");

  const versionedDocsPath = path.join(siteDir, "versioned_docs", `version-${options.version}`);
  const versionedSidebarsDir = path.join(siteDir, "versioned_sidebars");

  const backupDocsDir = path.join(backupDir, "docs");
  const backupSidebarPath = path.join(backupDir, "sidebars");

  let restoreNeeded = false;
  try {
    await exportPathsFromGitRef({
      repoRoot,
      gitRef: resolvedGitRef,
      paths: [options.docsDir, options.sidebarPath],
      destDir: exportDir,
    });

    const exportedDocsDir = path.join(exportDir, options.docsDir);
    const exportedSidebarPath = path.join(exportDir, options.sidebarPath);

    if (!(await pathExists(exportedDocsDir))) {
      throw new Error(`Exported branch ${options.gitRef} does not contain ${options.docsDir}/`);
    }
    if (!(await pathExists(exportedSidebarPath))) {
      throw new Error(`Exported branch ${options.gitRef} does not contain ${options.sidebarPath}`);
    }

    // Backup current docs + sidebars.
    if (await pathExists(repoDocsDir)) {
      await fs.cp(repoDocsDir, backupDocsDir, { recursive: true });
    }
    if (await pathExists(repoSidebarPath)) {
      await fs.copyFile(repoSidebarPath, backupSidebarPath);
    }
    restoreNeeded = true;

    // Swap in branch content.
    await removeIfExists(repoDocsDir);
    await fs.cp(exportedDocsDir, repoDocsDir, { recursive: true });

    await removeIfExists(repoSidebarPath);
    await fs.mkdir(path.dirname(repoSidebarPath), { recursive: true });
    await fs.copyFile(exportedSidebarPath, repoSidebarPath);

    // Remove existing version so Docusaurus can recreate it.
    const versions = (await readJsonArray(versionsPath)) ?? [];
    const filtered = versions.filter((v) => v !== options.version);
    if (await pathExists(versionsPath)) {
      await writeJsonArray(versionsPath, filtered);
    }

    await removeIfExists(versionedDocsPath);
    await fs.mkdir(versionedSidebarsDir, { recursive: true });
    for (const ext of ["json", "js", "cjs"]) {
      await removeIfExists(path.join(versionedSidebarsDir, `version-${options.version}-sidebars.${ext}`));
    }

    const docusaurusBin = findLocalDocusaurusBin(siteDir);
    if (!(await pathExists(docusaurusBin))) {
      throw new Error(
        `Could not find Docusaurus binary at ${docusaurusBin}. Ensure dependencies are installed in the product docs repo.`,
      );
    }

    await runCommand(docusaurusBin, ["docs:version", options.version], { cwd: siteDir });

    // Deterministic ordering (descending SemVer) for the dropdown.
    const updated = (await readJsonArray(versionsPath)) ?? [];
    await writeJsonArray(versionsPath, sortVersionsDesc(updated));
  } finally {
    if (restoreNeeded) {
      // Restore original docs + sidebars for the default branch build.
      await removeIfExists(repoDocsDir);
      if (await pathExists(backupDocsDir)) {
        await fs.cp(backupDocsDir, repoDocsDir, { recursive: true });
      }

      await removeIfExists(repoSidebarPath);
      if (await pathExists(backupSidebarPath)) {
        await fs.mkdir(path.dirname(repoSidebarPath), { recursive: true });
        await fs.copyFile(backupSidebarPath, repoSidebarPath);
      }
    }

    await removeIfExists(tmpRoot);
  }
}
