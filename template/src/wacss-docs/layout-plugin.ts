// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PluginFactoryContext } from 'satteri';

const root = process.cwd();
const pagesDir = path.join(root, 'src', 'pages');
// Astro resolves the symlinked pages directory to the served directory before
// handing a file URL to the Markdown processor, so accept both paths.
const pagesRealDir = fs.realpathSync(pagesDir);
const layoutFile = path.join(root, 'src', 'layouts', 'WacssDocs.astro');

/** @param {string} file */
const isPageFile = (file) =>
  [pagesDir, pagesRealDir].some(
    (dir) => file.startsWith(`${dir}${path.sep}`)
  );

/**
 * Apply the wacss-docs layout to every Markdown and MDX page without asking
 * authors to add `layout:` frontmatter. A relative path is used because Astro
 * resolves the layout property from the page's own directory, and pages may be
 * nested. An explicit `layout:` in a page always wins.
 *
 * Sätteri plugin factories receive the Astro frontmatter bag in `ctx.data.astro`,
 * which is where Astro reads the special `layout` property from. The factory
 * runs before the document is parsed, so it can set that property in place.
 */
export const wacssDocsLayoutPlugin = (ctx: PluginFactoryContext) => {
  const frontmatter = ctx.data.astro?.frontmatter;
  if (!frontmatter || (typeof frontmatter.layout === 'string' && frontmatter.layout.length > 0)) {
    return false;
  }
  const file = ctx.fileURL ? fileURLToPath(ctx.fileURL) : undefined;
  if (!file || !isPageFile(file)) {
    return false;
  }
  const relative = path
    .relative(path.dirname(file), layoutFile)
    .split(path.sep)
    .join('/');
  frontmatter.layout = relative.startsWith('.') ? relative : `./${relative}`;
  return { name: 'ssg-wacss-docs-layout', before() {} };
};
