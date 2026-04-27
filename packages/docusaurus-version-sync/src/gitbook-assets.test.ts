import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { rewriteGitbookImageRefsInFile } from "./gitbook-assets";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("rewriteGitbookImageRefsInFile", () => {
  test("rewrites refs to imports, preserves markup, and copies nested assets once per unique ref", async () => {
    const rootDir = await makeTempDir("gitbook-assets-test-");
    const docsDir = path.join(rootDir, "docs");
    const gitbookAssetsDir = path.join(rootDir, "static", "img", "gitbook");
    await fs.mkdir(path.join(docsDir, "guides"), { recursive: true });
    await fs.mkdir(path.join(gitbookAssetsDir, "screenshots"), { recursive: true });

    const docFilePath = path.join(docsDir, "guides", "verify.md");
    await fs.writeFile(
      docFilePath,
      [
        "---",
        'title: "Verify"',
        "---",
        "",
        '<figure><img src="/img/gitbook/Slide3.png" alt="Welcome diagram" width="375" /><figcaption></figcaption></figure>',
        "",
        '<div align="left"><figure><img src="/img/gitbook/screenshots/step.png" alt="" /><figcaption><p>Success message</p></figcaption></figure></div>',
        "",
        '<figure><img src="/img/gitbook/Slide3.png" alt="Welcome diagram" width="375" /><figcaption></figcaption></figure>',
        "",
      ].join("\n"),
      "utf8",
    );

    await fs.writeFile(path.join(gitbookAssetsDir, "Slide3.png"), "slide3", "utf8");
    await fs.writeFile(path.join(gitbookAssetsDir, "screenshots", "step.png"), "step", "utf8");

    const result = await rewriteGitbookImageRefsInFile({
      docFilePath,
      gitbookAssetsDir,
    });

    expect(result).toEqual({ rewritten: true, copiedAssets: 2 });

    const rewritten = await fs.readFile(docFilePath, "utf8");
    expect(rewritten).toContain('import gitbookAsset1 from "./verify.assets/Slide3.png";');
    expect(rewritten).toContain('import gitbookAsset2 from "./verify.assets/screenshots/step.png";');
    expect(rewritten).toContain('<figure><img src={gitbookAsset1} alt="Welcome diagram" width="375" /><figcaption></figcaption></figure>');
    expect(rewritten).toContain('<div align="left"><figure><img src={gitbookAsset2} alt="" /><figcaption><p>Success message</p></figcaption></figure></div>');
    expect(rewritten.match(/import gitbookAsset1/g)).toHaveLength(1);

    await expect(fs.readFile(path.join(docsDir, "guides", "verify.assets", "Slide3.png"), "utf8")).resolves.toBe("slide3");
    await expect(
      fs.readFile(path.join(docsDir, "guides", "verify.assets", "screenshots", "step.png"), "utf8"),
    ).resolves.toBe("step");
  });

  test("fails clearly when a referenced asset is missing", async () => {
    const rootDir = await makeTempDir("gitbook-assets-test-");
    const docsDir = path.join(rootDir, "docs");
    const gitbookAssetsDir = path.join(rootDir, "static", "img", "gitbook");
    await fs.mkdir(docsDir, { recursive: true });
    await fs.mkdir(gitbookAssetsDir, { recursive: true });

    const docFilePath = path.join(docsDir, "index.md");
    await fs.writeFile(docFilePath, '<figure><img src="/img/gitbook/missing.png" alt="" /></figure>\n', "utf8");

    await expect(
      rewriteGitbookImageRefsInFile({
        docFilePath,
        gitbookAssetsDir,
      }),
    ).rejects.toThrow("Missing GitBook asset");
  });
});
