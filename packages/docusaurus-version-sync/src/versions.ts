export function isPlainSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

type Parsed = { major: number; minor: number; patch: number };

function parsePlainSemver(value: string): Parsed | null {
  if (!isPlainSemver(value)) return null;
  const [major, minor, patch] = value.split(".").map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return null;
  return { major, minor, patch };
}

function compareParsedDesc(a: Parsed, b: Parsed): number {
  if (a.major !== b.major) return b.major - a.major;
  if (a.minor !== b.minor) return b.minor - a.minor;
  return b.patch - a.patch;
}

/**
 * Sorts SemVer-like X.Y.Z versions descending. Non-matching versions are kept
 * at the end, preserving original order.
 */
export function sortVersionsDesc(values: string[]): string[] {
  const parsed = values.map((value, index) => ({ value, index, parsed: parsePlainSemver(value) }));
  const semver = parsed.filter((x) => x.parsed !== null) as Array<{
    value: string;
    index: number;
    parsed: Parsed;
  }>;
  const other = parsed.filter((x) => x.parsed === null);

  semver.sort((a, b) => compareParsedDesc(a.parsed, b.parsed));
  return [...semver.map((x) => x.value), ...other.sort((a, b) => a.index - b.index).map((x) => x.value)];
}

