import path from "node:path";
import type { Plugin, LoadContext } from "@docusaurus/types";

export default function themePlugin(_context: LoadContext): Plugin<void> {
  return {
    name: "@ascertia-integrations/docusaurus-preset-docs-theme",
    getThemePath() {
      return path.resolve(__dirname, "..", "theme");
    },
    getTypeScriptThemePath() {
      return path.resolve(__dirname, "..", "theme");
    },
  };
}

