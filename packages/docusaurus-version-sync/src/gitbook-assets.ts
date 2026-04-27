import fs from "node:fs/promises";
import path from "node:path";

const GITBOOK_IMAGE_PREFIX = "/img/gitbook/";
const GITBOOK_SRC_ATTR_REGEX = /src="\/img\/gitbook\/([^"]+)"/g;
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);

export type RewriteGitbookAssetsResult = {
  filesRewritten: number;
  copiedAssets: number;
};

export async function rewriteGitbookImageRefsInDir(options: {
  docsDir: string;
  gitbookAssetsDir: string;
}): Promise<RewriteGitbookAssetsResult> {
  const docFiles = await collectMarkdownFiles(options.docsDir);
  let filesRewritten = 0;
  let copiedAssets = 0;

  for (const docFilePath of docFiles) {
    const result = await rewriteGitbookImageRefsInFile({
      docFilePath,
      gitbookAssetsDir: options.gitbookAssetsDir,
    });

    if (result.rewritten) {
      filesRewritten += 1;
      copiedAssets += result.copiedAssets;
    }
  }

  return { filesRewritten, copiedAssets };
}

export async function rewriteGitbookImageRefsInFile(options: {
  docFilePath: string;
  gitbookAssetsDir: string;
}): Promise<{ rewritten: boolean; copiedAssets: number }> {
  const original = await fs.readFile(options.docFilePath, "utf8");
  const assetRefs = extractGitbookImageRefs(original);
  if (assetRefs.length === 0) {
    return { rewritten: false, copiedAssets: 0 };
  }

  try {
    await fs.stat(options.gitbookAssetsDir);
  } catch {
    throw new Error(
      `Document ${options.docFilePath} references ${GITBOOK_IMAGE_PREFIX} assets, but ${options.gitbookAssetsDir} was not exported.`,
    );
  }

  const docDir = path.dirname(options.docFilePath);
  const docStem = path.basename(options.docFilePath, path.extname(options.docFilePath));
  const assetDirName = `${docStem}.assets`;
  const assetDirPath = path.join(docDir, assetDirName);

  let rewritten = original;
  let copiedAssets = 0;
  const importLines: string[] = [];

  for (const [index, assetRef] of assetRefs.entries()) {
    const sourcePath = path.join(options.gitbookAssetsDir, ...assetRef.split("/"));
    const targetPath = path.join(assetDirPath, ...assetRef.split("/"));

    try {
      await fs.stat(sourcePath);
    } catch {
      throw new Error(`Missing GitBook asset for ${options.docFilePath}: ${path.posix.join("static/img/gitbook", assetRef)}`);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
    copiedAssets += 1;

    const importName = `gitbookAsset${index + 1}`;
    const importPath = `./${toPosixPath(path.posix.join(assetDirName, assetRef))}`;
    importLines.push(`import ${importName} from "${importPath}";`);
    rewritten = rewritten.split(`src="${GITBOOK_IMAGE_PREFIX}${assetRef}"`).join(`src={${importName}}`);
  }

  const { frontMatter, body } = splitFrontMatter(rewritten);
  const importBlock = `${importLines.join("\n")}\n\n`;
  const updated = frontMatter.length > 0 ? `${frontMatter}${importBlock}${body}` : `${importBlock}${rewritten}`;
  await fs.writeFile(options.docFilePath, updated, "utf8");

  return { rewritten: true, copiedAssets };
}

function splitFrontMatter(content: string): { frontMatter: string; body: string } {
  const match = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n*)/);
  const frontMatter = match?.[1] ?? "";
  return {
    frontMatter,
    body: content.slice(frontMatter.length),
  };
}

function extractGitbookImageRefs(content: string): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(GITBOOK_SRC_ATTR_REGEX)) {
    const rawRef = match[1];
    if (!rawRef) continue;
    const normalizedRef = normalizeGitbookAssetRef(rawRef);
    if (seen.has(normalizedRef)) continue;
    seen.add(normalizedRef);
    refs.push(normalizedRef);
  }

  return refs;
}

function normalizeGitbookAssetRef(rawRef: string): string {
  const normalized = path.posix.normalize(rawRef.trim().replaceAll("\\", "/"));
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Unsupported GitBook asset ref: ${rawRef}`);
  }
  return normalized;
}

async function collectMarkdownFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function toPosixPath(value: string): string {
  return value.replaceAll(path.sep, "/");
}
