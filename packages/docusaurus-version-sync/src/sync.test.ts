import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { pruneVersion } from "./sync";

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
