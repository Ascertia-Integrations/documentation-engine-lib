import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chmod } from "node:fs/promises";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { pruneVersion, syncVersionFromGitRef } from "./sync";

const tempDirs: string[] = [];

async function makeTempSite(): Promise<string> {
  const siteDir = await fs.mkdtemp(path.join(os.tmpdir(), "docusaurus-version-sync-test-"));
  tempDirs.push(siteDir);
  await fs.mkdir(path.join(siteDir, "versioned_docs", "version-2.0.0", "nested"), { recursive: true });
  await fs.mkdir(path.join(siteDir, "versioned_sidebars"), { recursive: true });
  await fs.writeFile(path.join(siteDir, "versioned_docs", "version-2.0.0", "index.mdx"), "# v2.0.0\n", "utf8");
  await fs.writeFile(
    path.join(siteDir, "versioned_sidebars", "version-2.0.0-sidebars.json"),
    "{\"sidebar\":[]}\n",
    "utf8",
  );
  await fs.writeFile(path.join(siteDir, "versions.json"), "[\n  \"2.0.0\",\n  \"1.0.0\"\n]\n", "utf8");
  return siteDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function run(cmd: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(" ")} failed (code ${code})\n${stderr}`.trim()));
        return;
      }
      resolve();
    });
  });
}

async function makeSyncTestRepo(): Promise<string> {
  const siteDir = await fs.mkdtemp(path.join(os.tmpdir(), "docusaurus-version-sync-repo-"));
  tempDirs.push(siteDir);

  await fs.mkdir(path.join(siteDir, "docs"), { recursive: true });
  await fs.mkdir(path.join(siteDir, "node_modules", ".bin"), { recursive: true });
  await fs.writeFile(path.join(siteDir, "docs", "index.md"), "# current\n", "utf8");
  await fs.writeFile(path.join(siteDir, "sidebars.ts"), "export default {};\n", "utf8");
  await fs.writeFile(path.join(siteDir, "versions.json"), "[]\n", "utf8");

  const fakeDocusaurusPath = path.join(siteDir, "node_modules", ".bin", process.platform === "win32" ? "docusaurus.cmd" : "docusaurus");
  const fakeDocusaurusScript = [
    "#!/usr/bin/env node",
    "const fs = require('fs');",
    "const path = require('path');",
    "const [, , command, version] = process.argv;",
    "if (command !== 'docs:version' || !version) process.exit(2);",
    "function copyDir(src, dest) {",
    "  fs.mkdirSync(dest, {recursive: true});",
    "  for (const entry of fs.readdirSync(src, {withFileTypes: true})) {",
    "    const srcPath = path.join(src, entry.name);",
    "    const destPath = path.join(dest, entry.name);",
    "    if (entry.isDirectory()) copyDir(srcPath, destPath);",
    "    else fs.copyFileSync(srcPath, destPath);",
    "  }",
    "}",
    "const siteDir = process.cwd();",
    "const versionedDocsDir = path.join(siteDir, 'versioned_docs', `version-${version}`);",
    "const versionedSidebarsDir = path.join(siteDir, 'versioned_sidebars');",
    "fs.rmSync(versionedDocsDir, {recursive: true, force: true});",
    "copyDir(path.join(siteDir, 'docs'), versionedDocsDir);",
    "fs.mkdirSync(versionedSidebarsDir, {recursive: true});",
    "fs.writeFileSync(path.join(versionedSidebarsDir, `version-${version}-sidebars.json`), '{\"sidebar\":[]}\\n');",
    "const versionsPath = path.join(siteDir, 'versions.json');",
    "const versions = fs.existsSync(versionsPath) ? JSON.parse(fs.readFileSync(versionsPath, 'utf8')) : [];",
    "if (!versions.includes(version)) versions.push(version);",
    "fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\\n');",
  ].join("\n");
  await fs.writeFile(fakeDocusaurusPath, fakeDocusaurusScript, "utf8");
  await chmod(fakeDocusaurusPath, 0o755);

  await run("git", ["init", "-b", "main"], siteDir);
  await run("git", ["config", "user.name", "Test User"], siteDir);
  await run("git", ["config", "user.email", "test@example.com"], siteDir);
  await run("git", ["add", "."], siteDir);
  await run("git", ["commit", "-m", "initial"], siteDir);

  await run("git", ["checkout", "-b", "2.3.0"], siteDir);
  await fs.mkdir(path.join(siteDir, "static", "img", "gitbook"), { recursive: true });
  await fs.writeFile(path.join(siteDir, "docs", "index.md"), '<figure><img src="/img/gitbook/Slide3.png" alt="Diagram" width="375" /><figcaption></figcaption></figure>\n', "utf8");
  await fs.writeFile(path.join(siteDir, "static", "img", "gitbook", "Slide3.png"), "diagram", "utf8");
  await run("git", ["add", "."], siteDir);
  await run("git", ["commit", "-m", "release docs"], siteDir);
  await run("git", ["checkout", "main"], siteDir);

  return siteDir;
}

describe("pruneVersion", () => {
  test("removes generated artifacts and updates versions.json", async () => {
    const siteDir = await makeTempSite();

    await pruneVersion({
      siteDir,
      version: "2.0.0",
      allowDirty: true,
    });

    await expect(fs.stat(path.join(siteDir, "versioned_docs", "version-2.0.0"))).rejects.toThrow();
    await expect(fs.stat(path.join(siteDir, "versioned_sidebars", "version-2.0.0-sidebars.json"))).rejects.toThrow();
    await expect(fs.readFile(path.join(siteDir, "versions.json"), "utf8")).resolves.toBe("[\n  \"1.0.0\"\n]\n");
  });
});

describe("syncVersionFromGitRef", () => {
  test("rewrites GitBook image refs before versioning and restores current docs afterwards", async () => {
    const siteDir = await makeSyncTestRepo();

    await syncVersionFromGitRef({
      siteDir,
      docsDir: "docs",
      sidebarPath: "sidebars.ts",
      gitRef: "2.3.0",
      version: "2.3.0",
      allowDirty: true,
      dryRun: false,
    });

    await expect(fs.readFile(path.join(siteDir, "docs", "index.md"), "utf8")).resolves.toBe("# current\n");

    const versionedDoc = await fs.readFile(path.join(siteDir, "versioned_docs", "version-2.3.0", "index.md"), "utf8");
    expect(versionedDoc).toContain('import gitbookAsset1 from "./index.assets/Slide3.png";');
    expect(versionedDoc).toContain('<figure><img src={gitbookAsset1} alt="Diagram" width="375" /><figcaption></figcaption></figure>');
    await expect(fs.readFile(path.join(siteDir, "versioned_docs", "version-2.3.0", "index.assets", "Slide3.png"), "utf8")).resolves.toBe("diagram");
    await expect(fs.readFile(path.join(siteDir, "versions.json"), "utf8")).resolves.toBe("[\n  \"2.3.0\"\n]\n");
  });
});
