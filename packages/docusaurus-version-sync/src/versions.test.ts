import { describe, expect, test } from "vitest";
import { isPlainSemver, sortVersionsDesc } from "./versions";

describe("isPlainSemver", () => {
  test("accepts X.Y.Z", () => {
    expect(isPlainSemver("1.2.3")).toBe(true);
  });

  test("rejects prerelease/build metadata", () => {
    expect(isPlainSemver("1.2.3-alpha")).toBe(false);
    expect(isPlainSemver("1.2.3+build")).toBe(false);
  });
});

describe("sortVersionsDesc", () => {
  test("sorts descending semver", () => {
    expect(sortVersionsDesc(["1.2.0", "1.10.0", "2.0.0", "1.9.9"])).toEqual(["2.0.0", "1.10.0", "1.9.9", "1.2.0"]);
  });

  test("keeps non-semver at end with order preserved", () => {
    expect(sortVersionsDesc(["1.0.0", "next", "2.0.0", "beta"])).toEqual(["2.0.0", "1.0.0", "next", "beta"]);
  });
});

