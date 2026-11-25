// @ts-check
import fs from "node:fs"
import path from "node:path"

import { globSync } from "tinyglobby"

/** Page file types in duplicate-route priority order. */
export const PAGE_EXTENSIONS = [".astro", ".html", ".md", ".mdx", ".typ"]

// HTML written by `astro-ssg build` carries this marker so it never shadows
// the source page it was compiled from when the directory is served again.
export const GENERATED_HTML_MARKER = "<!-- astro-ssg:generated -->"

/**
 * @typedef {{
 *   file: string,
 *   path: string,
 *   url: string,
 *   actual: string,
 *   lookup: string,
 *   priority: number,
 * }} Page
 */

/** @param {string} file @returns {boolean} */
const isGeneratedHtml = (file) => {
  if (path.extname(file).toLowerCase() !== ".html") return false
  try {
    return fs.readFileSync(file, "utf8").includes(GENERATED_HTML_MARKER)
  } catch {
    return false
  }
}

/**
 * @param {string} route
 * @returns {string}
 */
const encodeRoute = (route) =>
  route === "/"
    ? "/"
    : `/${route.split("/").filter(Boolean).map(encodeURIComponent).join("/")}${
        route.endsWith("/") ? "/" : ""
      }`

/**
 * List the page files under dir, mirroring Astro's file-based routing.
 *
 * Dotfiles, underscore-prefixed files and directories, node_modules,
 * dynamic routes, the root 404 page, and the root index page are ignored.
 *
 * Routes are extensionless. `path` is lowercase and keeps the trailing slash
 * of index pages, `url` is the encoded version of `path`, `actual` keeps the
 * original case, and `lookup` is lowercase without a trailing slash.
 *
 * When several files map to one route, PAGE_EXTENSIONS decides the winner.
 * HTML emitted by `astro-ssg build` is ranked below every source type so an
 * up-to-date `.astro`/`.md`/`.mdx`/`.typ` file still wins after a build.
 *
 * @param {string} dir
 * @returns {Page[]}
 */
export const listPages = (dir) => {
  /** @type {Map<string, Page>} */
  const pages = new Map()

  const files = globSync(["**/*.{astro,html,md,mdx,typ}"], {
    cwd: dir,
    ignore: ["**/_*", "**/_*/**", "**/node_modules/**"],
    followSymbolicLinks: false,
  })

  for (const raw of files) {
    const file = raw.replaceAll(path.sep, "/")
    const segments = file.split("/")
    const name = segments.pop() ?? ""
    const extension = path.posix.extname(name)
    const extensionPriority = PAGE_EXTENSIONS.indexOf(extension)
    if (extensionPriority === -1) continue
    const priority = isGeneratedHtml(path.join(dir, file))
      ? PAGE_EXTENSIONS.length
      : extensionPriority

    const base = name.slice(0, -extension.length)

    // Dynamic routes cannot be linked without their parameters.
    if (base.includes("[")) continue

    // The root 404 page is not a normal destination.
    if (base === "404" && segments.length === 0) continue

    // The root index is the page the default page stands in for.
    if (base === "index" && segments.length === 0) continue

    const isIndex = base === "index"
    const route = isIndex ? segments : [...segments, base]
    const actual =
      route.length === 0 ? "/" : `/${route.join("/")}${isIndex ? "/" : ""}`
    const routePath = actual.toLowerCase()
    const existing = pages.get(routePath)
    if (existing && existing.priority <= priority) continue

    pages.set(routePath, {
      file,
      path: routePath,
      url: encodeRoute(routePath),
      actual,
      lookup: routePath.replace(/\/+$/, "") || "/",
      priority,
    })
  }

  return [...pages.values()].sort((a, b) => a.path.localeCompare(b.path))
}
