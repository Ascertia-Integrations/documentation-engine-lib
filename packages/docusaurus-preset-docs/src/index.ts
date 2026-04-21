import path from "node:path";

type DocusaurusPreset = (context: unknown, options: unknown) => unknown;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function mergeThemeCustomCss(existing: unknown, add: string): unknown {
  const existingArray = asArray(existing as string | string[] | undefined);
  if (existingArray.includes(add)) return existingArray;
  return [add, ...existingArray];
}

export default function presetDocs(context: unknown, options: any): unknown {
  // Late-load to keep this package lightweight; the consumer repo provides Docusaurus deps.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const classicPreset: DocusaurusPreset =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("@docusaurus/preset-classic").default ??
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("@docusaurus/preset-classic");

  const packageRoot = path.resolve(__dirname, "..");
  const sharedCssPath = path.join(packageRoot, "theme", "custom.css");

  const resolvedOptions = {
    ...(options ?? {}),
    theme: {
      ...(options?.theme ?? {}),
      customCss: mergeThemeCustomCss(options?.theme?.customCss, sharedCssPath),
    },
  };

  const classicResult: any = classicPreset(context, resolvedOptions);

  // Add our theme components (theme folder) without replacing the classic preset theme.
  const themes = Array.isArray(classicResult?.themes) ? classicResult.themes : [];
  return {
    ...classicResult,
    themes: [...themes, packageRoot],
  };
}

