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
    getThemeConfig() {
      return {
        navbar: {
          items: [
            {
              type: "docsVersionDropdown",
              position: "right",
            },
          ],
        },
        footer: {
          style: "dark",
          links: [
            {
              title: "Docs",
              items: [
                {
                  label: "Documentation Index",
                  to: "/",
                },
              ],
            },
            {
              title: "Community",
              items: [
                {
                  label: "GitHub",
                  href: "https://github.com/Ascertia-Integrations",
                },
              ],
            },
          ],
          copyright: `Copyright © ${new Date().getFullYear()} Ascertia Integrations. Built with Docusaurus.`,
        },
      };
    },
  };
}

