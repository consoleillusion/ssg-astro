// @ts-check
import fs from 'node:fs';
import path from 'node:path';

import { listPages } from '../routes.js';

/**
 * The wacss-docs template reads an optional `wacss-docs.json` from the served
 * directory (`docs.json` is also accepted). It supplies the shell's words and
 * the chapter grouping; every page is still discovered from the directory
 * itself, so adding a Markdown file adds a page.
 *
 * ```json
 * {
 *   "title": "SRS design book",
 *   "description": "Goals, rules, protocol and roadmap.",
 *   "palette": "aizome",
 *   "groups": [
 *     {
 *       "title": "Project",
 *       "description": "Why the project exists.",
 *       "pages": ["why.md", { "page": "introduction.md", "title": "Introduction" }]
 *     }
 *   ],
 *   "links": [{ "label": "PDF", "href": "https://example.com/book.pdf" }]
 * }
 * ```
 */

export type DocLink = { label: string; href: string };
export type DocItem = { url: string; label: string; description: string; file: string };
export type DocGroup = { title: string; description: string; items: DocItem[] };
export type DocSite = {
  title: string;
  description: string;
  home: string;
  palette: string;
  footer: string;
  links: DocLink[];
  groups: DocGroup[];
  items: DocItem[];
  itemFor: (url: string) => DocItem | undefined;
  neighbors: (url: string) => { previous?: DocItem; next?: DocItem };
};

type RawEntry = string | { page: string; title?: string; description?: string };
type RawGroup = { title?: string; description?: string; pages?: RawEntry[] };
type RawConfig = {
  title?: string;
  description?: string;
  home?: string;
  palette?: string;
  footer?: string;
  links?: DocLink[];
  groups?: RawGroup[];
  hide?: string[];
  ungroupedTitle?: string;
};

const pagesDir = path.join(process.cwd(), 'src', 'pages');
const configFile =
  ['wacss-docs.json', 'docs.json']
    .map((name) => path.join(pagesDir, name))
    .find((file) => fs.existsSync(file)) ?? path.join(pagesDir, 'wacss-docs.json');

/** The key used to match a config entry against a discovered page. */
const keyOf = (value: string): string => {
  let key = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  key = key.replace(/\.(astro|html|md|mdx|typ)$/i, '');
  return key.toLowerCase();
};

const titleCase = (value: string): string =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

/** A page's first H1, or its filename made presentable. */
const headingOf = (file: string | undefined): string | undefined => {
  if (!file) return undefined;
  let source;
  try {
    source = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  } catch {
    return undefined;
  }
  const heading = source.match(/^#\s+(.+?)\s*#*\s*$/m);
  if (!heading) return undefined;
  return heading[1]!.replace(/[*_`]/g, '').trim();
};

/** The first prose paragraph, used as a small description in cards and search. */
const summaryOf = (file: string | undefined): string => {
  if (!file) return '';
  let source;
  try {
    source = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  } catch {
    return '';
  }
  const lines = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').split(/\r?\n/);
  let paragraph: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(#|```|~~~|<!--|\||>|Status:)/.test(trimmed)) {
      if (paragraph.length > 0) break;
      continue;
    }
    if (trimmed === '') {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(trimmed);
  }
  return paragraph
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 180)
    .trim();
};

const readConfig = (): RawConfig => {
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8')) as RawConfig;
  } catch (error) {
    if ((/** @type {NodeJS.ErrnoException} */ (error)).code !== 'ENOENT') {
      console.warn(`${path.basename(configFile)} could not be read: ${/** @type {Error} */ (error).message}`);
    }
    return {};
  }
};

const normalizeUrl = (url: string): string => {
  const pathname = url.split(/[?#]/)[0] ?? '/';
  return pathname.replace(/\/+$/, '') || '/';
};

/** Discover pages and resolve the config's groups against them. */
export const loadWacssDocsSite = (): DocSite => {
  const raw = readConfig();
  const discovered = listPages(pagesDir);
  const hidden = new Set((raw.hide ?? []).map(keyOf));
  const byKey = new Map<string, string>();

  for (const page of discovered) {
    const url = page.lookup === '/' ? '/' : page.lookup;
    const keys = [keyOf(url), keyOf(page.file), keyOf(path.basename(page.file))];
    for (const key of keys) {
      if (key && !byKey.has(key)) byKey.set(key, url);
    }
  }
  byKey.set('index', '/');

  const item = (entry: RawEntry): DocItem | undefined => {
    const spec = typeof entry === 'string' ? { page: entry } : entry;
    if (!spec || typeof spec.page !== 'string') return undefined;
    const key = keyOf(spec.page);
    const url = byKey.get(key);
    if (!url || url === '/' || hidden.has(key)) return undefined;
    const file = discovered.find((page) =>
      (page.lookup === '/' ? '/' : page.lookup) === url
    )?.file;
    return {
      url,
      label: spec.title ?? headingOf(file) ?? titleCase(key.split('/').pop() ?? key),
      description: spec.description ?? summaryOf(file),
      file: file ?? '',
    };
  };

  const used = new Set<string>();
  const groups: DocGroup[] = (raw.groups ?? []).map((group) => {
    const items = (group.pages ?? [])
      .map(item)
      .filter((value): value is DocItem => {
        if (!value || used.has(value.url)) return false;
        used.add(value.url);
        return true;
      });
    return { title: group.title ?? 'Pages', description: group.description ?? '', items };
  });

  const rest = discovered
    .filter((page) => {
      const url = page.lookup === '/' ? '/' : page.lookup;
      return url !== '/' && !used.has(url) && !hidden.has(keyOf(page.file));
    })
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((page) => ({
      url: page.lookup,
      label: headingOf(page.file) ?? titleCase(path.basename(page.file, path.extname(page.file))),
      description: summaryOf(page.file),
      file: page.file,
    }));
  if (rest.length > 0) {
    groups.push({ title: raw.ungroupedTitle ?? 'More pages', description: '', items: rest });
  }

  const items = groups.flatMap((group) => group.items);
  return {
    title: raw.title ?? 'Documentation',
    description: raw.description ?? '',
    home: raw.home ?? '/',
    palette: raw.palette ?? 'kinari',
    footer: raw.footer ?? '',
    links: (raw.links ?? []).filter((link) => link && typeof link.href === 'string' && typeof link.label === 'string'),
    groups: groups.filter((group) => group.items.length > 0),
    items,
    itemFor: (url) => items.find((entry) => entry.url === normalizeUrl(url)),
    neighbors: (url) => {
      const index = items.findIndex((entry) => entry.url === normalizeUrl(url));
      if (index < 0) return {};
      return {
        previous: items[index - 1],
        next: items[index + 1],
      };
    },
  };
};
