#!/usr/bin/env node
// @ts-check
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cac } from "cac"
import { compareVersions } from "compare-versions"

import { listPages } from "../template/src/routes.js"

/**
 * @typedef {{ version: string }} PackageJson
 * @typedef {"sakura" | "milligram" | "skeleton"} ClasslessTheme
 * @typedef {{ dir?: string, noDefaultPage: boolean, classless: ClasslessTheme | null, port: string | null, host: string | null }} ServeOptions
 * @typedef {import("node:child_process").SpawnOptions} SpawnOptions
 * @typedef {{
 *   command: string,
 *   installArgs: string[],
 *   devArgs: (astroArgs: string[]) => string[],
 *   shell: boolean,
 * }} PackageManager
 */

const packageRoot = fileURLToPath(new URL("..", import.meta.url))
const templateDir = path.join(packageRoot, "template")
const packageJson = /** @type {PackageJson} */ (
  JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"))
)

const MINIMUM_NODE = "22.23.4"
/** @type {readonly string[]} */
const INDEX_FILES = ["index.astro", "index.html", "index.md", "index.mdx"]
/** @type {readonly ClasslessTheme[]} */
const CLASSLESS_THEMES = ["sakura", "milligram", "skeleton"]
const DEFAULT_CLASSLESS_THEME = "sakura"
const GENERATED_INDEX_MARKER = "<!-- astro-ssg:generated-index -->"
const TEMPLATE_VERSION = "4"
const RUNNING_WITH_BUN = Boolean(process.versions.bun)

/** @param {string} message @returns {never} */
const fail = (message) =>
  (console.error(`astro-ssg: ${message}`), process.exit(1))

const defaultCacheDir = () =>
  process.env.ASTRO_SSG_CACHE
    ? path.resolve(process.env.ASTRO_SSG_CACHE)
    : process.platform === "win32"
      ? path.join
        ( process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local")
        , "astro-ssg"
        )
      : path.join
        ( process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache")
        , "astro-ssg"
        )

const CACHE_DIR = defaultCacheDir()
const PAGES_DIR = path.join(CACHE_DIR, "src", "pages")
const TEMPLATE_VERSION_PATH = path.join(CACHE_DIR, ".template-version")

// The lockfiles pin prebuilt native packages for both glibc and musl. The
// variant for the other libc cannot be dlopen'd, so it is dead weight
// (~50 MB).
/** @type {Record<"glibc" | "musl", readonly string[]>} */
const LIBC_PACKAGES = {
  // Delete on glibc (musl variants)
  glibc: [
    "lightningcss-linux-x64-musl",
    "lightningcss-linux-arm64-musl",
    "@img/sharp-linuxmusl-x64",
    "@img/sharp-libvips-linuxmusl-x64",
    "@img/sharp-linuxmusl-arm64",
    "@img/sharp-libvips-linuxmusl-arm64",
    "@rolldown/binding-linux-x64-musl",
    "@rolldown/binding-linux-arm64-musl",
  ],
  // Delete on musl (glibc variants)
  musl: [
    "lightningcss-linux-x64-gnu",
    "lightningcss-linux-arm64-gnu",
    "@img/sharp-linux-x64",
    "@img/sharp-libvips-linux-x64",
    "@img/sharp-linux-arm64",
    "@img/sharp-libvips-linux-arm64",
    "@rolldown/binding-linux-x64-gnu",
    "@rolldown/binding-linux-arm64-gnu",
  ],
}

/** @returns {"glibc" | "musl" | null} */
const detectLibc = () => {
  if (process.platform !== "linux") return null
  try {
    const report = /** @type {{ header?: { glibcVersionRuntime?: string } } | undefined} */ (
      process.report?.getReport?.()
    )
    if (report?.header?.glibcVersionRuntime) return "glibc"
  } catch {
    // Fall through to the ldd heuristic.
  }
  try {
    return /musl/i.test(fs.readFileSync("/usr/bin/ldd", "utf8")) ? "musl" : null
  } catch {
    return null
  }
}

/** @param {string} target @returns {number} */
const dirSize = (target) => {
  try {
    const stat = fs.statSync(target)
    if (!stat.isDirectory()) return stat.size
    return fs
      .readdirSync(target)
      .reduce((sum, name) => sum + dirSize(path.join(target, name)), 0)
  } catch {
    return 0
  }
}

/**
 * Remove prebuilt packages for the foreign libc from the cache's
 * node_modules. Called after every install; deleting directories that
 * already vanished is a no-op.
 * @param {string} nodeModulesDir
 */
const pruneForeignLibcPackages = (nodeModulesDir) => {
  const libc = detectLibc()
  if (!libc) return undefined
  const removed = LIBC_PACKAGES[libc].reduce(
    (acc, name) => {
      const target = path.join(nodeModulesDir, name)
      if (!fs.existsSync(target)) return acc
      const bytes = dirSize(target)
      removePath(target)
      return { count: acc.count + 1, bytes: acc.bytes + bytes }
    },
    { count: 0, bytes: 0 }
  )
  return removed.count > 0
    ? console.log(
        `removed ${removed.count} prebuilt packages for the foreign libc (${Math.round(removed.bytes / 1024 / 1024)} MB)`
      )
    : undefined
}

const checkNodeVersion = () =>
  RUNNING_WITH_BUN || compareVersions(process.versions.node, MINIMUM_NODE) >= 0
    ? undefined
    : fail(`Node.js ${MINIMUM_NODE} or newer is required; found ${process.versions.node}.`)

/** @param {string | undefined} dir @returns {string} */
const resolveServeDir = (dir) => {
  const serveDir = path.resolve(dir ?? ".")
  try {
    return fs.statSync(serveDir).isDirectory()
      ? serveDir
      : fail(`${serveDir} is not a directory.`)
  } catch (error) {
    const err = /** @type {NodeJS.ErrnoException} */ (error)
    return err.code === "ENOENT"
      ? fail(`${serveDir} does not exist.`)
      : (() => { throw error })()
  }
}

/** @param {string} target */
const removePath = (target) =>
  ((result) => result)(
    (() => {
      try {
        return ((stat) =>
          stat.isDirectory() && !stat.isSymbolicLink()
            ? fs.rmSync(target, { recursive: true, force: true })
            : fs.unlinkSync(target)
        )(fs.lstatSync(target))
      } catch (error) {
        const err = /** @type {NodeJS.ErrnoException} */ (error)
        return err.code === "ENOENT" ? undefined : (() => { throw error })()
      }
    })()
  )

/**
 * Make the cache writable. The template may come from a read-only source
 * (for example the Nix store), and the cache must stay writable so npm can
 * update package-lock.json and install node_modules.
 *
 * @param {string} dir
 */
const makeWritable = (dir) => {
  try {
    fs.chmodSync(dir, 0o755)
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name)
      entry.isDirectory() ? makeWritable(target) : fs.chmodSync(target, 0o644)
    }
  } catch {
    // Best effort; surfaces later if npm actually fails.
  }
}

/** @param {string} serveDir */
const assertCacheIsSafe = (serveDir) =>
  ((cache, served) =>
    served === cache ||
    served.startsWith(`${cache}${path.sep}`) ||
    cache.startsWith(`${served}${path.sep}`)
      ? fail("The cache directory and the served directory must not contain each other. Set ASTRO_SSG_CACHE somewhere else.")
      : undefined
  )(path.resolve(CACHE_DIR), path.resolve(serveDir))

/** @param {string} filePath @returns {boolean} */
const isGeneratedIndex = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8").includes(GENERATED_INDEX_MARKER)
  } catch {
    return false
  }
}

/** @param {string} serveDir @returns {boolean} */
const hasUserIndexPage = (serveDir) =>
  INDEX_FILES.some((file) => {
    const filePath = path.join(serveDir, file)
    return fs.existsSync(filePath) && (file !== "index.html" || !isGeneratedIndex(filePath))
  })

/** @param {string} value @returns {value is ClasslessTheme} */
const isClasslessTheme = (value) =>
  CLASSLESS_THEMES.some((theme) => theme === value)

/** @param {unknown} value @returns {ClasslessTheme | null} */
const normalizeClassless = (value) => {
  if (value === undefined || value === null || value === false) return null
  const theme =
    value === true ? DEFAULT_CLASSLESS_THEME : String(value).trim().toLowerCase()
  if (theme === "") return DEFAULT_CLASSLESS_THEME
  return isClasslessTheme(theme)
    ? theme
    : fail(
        `Unknown classless theme "${String(value)}". Choose one of: ${CLASSLESS_THEMES.join(", ")}. Put a directory argument before --classless.`
      )
}

/** @param {string} serveDir @param {boolean} noDefaultPage @returns {string} */
const indexMessage = (serveDir, noDefaultPage) =>
  hasUserIndexPage(serveDir)
    ? "Found an index page; / will serve it."
    : noDefaultPage
      ? "No index page found; / will return 404 (default page disabled)."
      : "No index page found; / will show the generated default page."

/** @param {string} serveDir @param {ServeOptions} options */
const writeDefaultIndex = (serveDir, options) => {
  const generatedPath = path.join(serveDir, "index.html")
  const generated = fs.existsSync(generatedPath) && isGeneratedIndex(generatedPath)
  const userIndex = INDEX_FILES.some((file) => {
    if (file === "index.html") return fs.existsSync(generatedPath) && !generated
    return fs.existsSync(path.join(serveDir, file))
  })

  if (userIndex) {
    // A real index page exists, so remove our stale generated one.
    if (generated) fs.rmSync(generatedPath, { force: true })
    return
  }

  if (options.noDefaultPage) {
    if (generated) fs.rmSync(generatedPath, { force: true })
    return
  }

  const pages = listPages(serveDir)
  const links = pages
    .map(({ path: pagePath, url }) => `<li><a href="${url}">${pagePath}</a></li>`)
    .join("\n")
  const pageList =
    pages.length > 0
      ? `<p>The following pages exist in this directory:</p><ul class="files">${links}</ul>`
      : "<p>No page files were found in this directory yet.</p>"
  const themeLink = options.classless
    ? `<link rel="stylesheet" href="/${options.classless}.css" data-ssg-classless="${options.classless}" />`
    : ""

  const html = `<!doctype html>
<html lang="en">
<head>
${GENERATED_INDEX_MARKER}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width" />
<title>astro-ssg default page</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:1rem;line-height:1.6}h1{margin-top:0}.files{padding-left:1.5rem;margin-top:1rem}</style>
${themeLink}
</head>
<body>
<h1>Default page served</h1>
<p>No index page was found. This default page is served with HTTP status 200.</p>
<p>This server accepts these file types as pages: <code>.astro</code>, <code>.html</code>, <code>.md</code>, <code>.mdx</code></p>
${pageList}
</body>
</html>
`

  if (generated && fs.readFileSync(generatedPath, "utf8") === html) return

  fs.writeFileSync(generatedPath, html)
  console.log(`Created default index.html at ${serveDir}`)
}

/** @returns {boolean} */
const cacheIsCurrent = () => {
  try {
    return (
      fs.existsSync(path.join(CACHE_DIR, "package.json")) &&
      fs.existsSync(PAGES_DIR) &&
      fs.readFileSync(TEMPLATE_VERSION_PATH, "utf8").trim() === TEMPLATE_VERSION
    )
  } catch {
    return false
  }
}

/** @param {string} serveDir @param {ServeOptions} options */
const initializeCache = (serveDir, options) =>
  ( assertCacheIsSafe(serveDir)
  , console.log(`copying template to ${CACHE_DIR}`)
  , fs.rmSync(CACHE_DIR, { recursive: true, force: true })
  , fs.mkdirSync(CACHE_DIR, { recursive: true })
  , fs.cpSync(templateDir, CACHE_DIR, { recursive: true })
  , makeWritable(CACHE_DIR)
  , fs.writeFileSync(TEMPLATE_VERSION_PATH, TEMPLATE_VERSION)
  , fs.rmSync(path.join(CACHE_DIR, ".classless"), { force: true })
  , fs.rmSync(path.join(CACHE_DIR, ".no-default-page"), { force: true })
  , fs.mkdirSync(path.dirname(PAGES_DIR), { recursive: true })
  , removePath(PAGES_DIR)
  , fs.symlinkSync(serveDir, PAGES_DIR, process.platform === "win32" ? "junction" : "dir")
  , console.log(`serving ${serveDir} as ${PAGES_DIR}`)
  , writeDefaultIndex(serveDir, options)
  , console.log(indexMessage(serveDir, options.noDefaultPage))
  , undefined
  )

/** @returns {PackageManager} */
const packageManager = () =>
  RUNNING_WITH_BUN
    ? ( { command: process.execPath
        , installArgs: ["install"]
        , devArgs: (astroArgs) => ["run", "dev", ...astroArgs]
        , shell: false
        }
      )
    : ( { command: process.platform === "win32" ? "npm.cmd" : "npm"
        , installArgs: ["install", "--no-audit", "--no-fund"]
        , devArgs: (astroArgs) =>
            astroArgs.length > 0 ? ["run", "dev", "--", ...astroArgs] : ["run", "dev"]
        , shell: process.platform === "win32"
        }
      )

/**
 * @param {string} command
 * @param {string[]} args
 * @param {SpawnOptions} [options]
 * @returns {Promise<number>}
 */
const run = (command, args, options = {}) =>
  /** @type {Promise<number>} */ (new Promise((resolve, reject) =>
    ((child) =>
      ( child.on("error", reject)
      , child.on("close", (code, signal) => resolve(code ?? (signal ? 1 : 0)))
      , child
      )
    )(
      spawn
        ( command
        , args
        , { stdio: "inherit"
          , shell: process.platform === "win32"
          , ...options
          }
        )
    )
  ))

/** @param {unknown} port @returns {string | null} */
const normalizePort = (port) =>
  port === undefined || port === null
    ? null
    : ((value) =>
        /^\d+$/.test(value) ? value : fail("--port must be a number.")
      )(String(port))

/** @param {unknown} host @returns {string | null} */
const normalizeHost = (host) =>
  host === undefined || host === null || host === false
    ? null
    : host === true
      ? "0.0.0.0"
      : String(host)

/** @param {ServeOptions} options @returns {string[]} */
const astroArgsFromOptions = (options) =>
  [ options.port !== null ? ["--port", options.port] : []
  , options.host !== null ? ["--host", options.host] : []
  ].flat()

/** @param {ServeOptions} options @param {string} serveDir */
const ensureInitialized = (options, serveDir) =>
  !cacheIsCurrent()
    ? (console.log("No current template cache found; initializing it for this directory."), initializeCache(serveDir, options))
    : ((linkedDir) =>
        fs.realpathSync(serveDir) !== linkedDir
          ? (console.log(`Cache is configured for ${linkedDir}; serving ${serveDir} instead.`), initializeCache(serveDir, options))
          : undefined
      )(fs.realpathSync(PAGES_DIR))

/** @param {ServeOptions} options @returns {NodeJS.ProcessEnv} */
const serveEnv = (options) =>
  ( options.noDefaultPage || options.classless
    ? { ...process.env
      , ...options.noDefaultPage ? { SSG_NO_DEFAULT_PAGE: "1" } : {}
      , ...options.classless ? { SSG_CLASSLESS: options.classless } : {}
      }
    : { ...process.env }
  )

/**
 * @param {PackageManager} manager
 * @param {NodeJS.ProcessEnv} env
 * @param {ServeOptions} options
 * @returns {Promise<void>}
 */
const runServe = (manager, env, options) =>
  (console.log("installing dependencies"),
  run
    ( manager.command
    , manager.installArgs
    , { cwd: CACHE_DIR
      , env
      , shell: manager.shell
      }
    ).then((installCode) =>
      installCode !== 0
        ? (process.exitCode = installCode, undefined)
        : (() => {
            pruneForeignLibcPackages(path.join(CACHE_DIR, "node_modules"))
            return run
              ( manager.command
              , manager.devArgs(astroArgsFromOptions(options))
              , { cwd: CACHE_DIR
                , env
                , shell: manager.shell
                }
              ).then((exitCode) => {
                process.exitCode = exitCode
              })
          })()
    ))

/** @param {ServeOptions} options @returns {Promise<void>} */
const serve = async (options) =>
  (async (serveDir) =>
    ( checkNodeVersion()
    , assertCacheIsSafe(serveDir)
    , ensureInitialized(options, serveDir)
    , writeDefaultIndex(serveDir, options)
    , await runServe(packageManager(), serveEnv(options), options)
    )
  )(resolveServeDir(options.dir))

const cli = cac("astro-ssg")

cli
  .command("serve [dir]", "Copy the template to the cache if needed, then install dependencies and start the dev server")
  .option("--no-default-page", "Do not provide the missing-index page at /")
  .option("--classless [theme]", `Style every route with a classless stylesheet (${CLASSLESS_THEMES.join(", ")})`)
  .option("--port <port>", "Port for the dev server")
  .option("--host [host]", "Expose the dev server on the network")
  .action(
    /** @param {string | undefined} dir @param {{ defaultPage?: boolean, classless?: boolean | string, port?: unknown, host?: unknown }} options */
    (dir, options) =>
      serve
        ( { dir
          , noDefaultPage: options.defaultPage === false
          , classless: normalizeClassless(options.classless)
          , port: normalizePort(options.port)
          , host: normalizeHost(options.host)
          }
        )
  )

cli.help((sections) =>
  sections.concat
    ( [ { title: "Cache"
        , body: `${CACHE_DIR}\nSet ASTRO_SSG_CACHE to use a different directory.`
        }
      ]
    )
)
cli.version(packageJson.version)

const parsed = cli.parse()

if (!cli.matchedCommand) {
  parsed.args.length === 0
    ? cli.outputHelp()
    : fail(`Unknown command "${parsed.args[0]}". This CLI has one command: serve. See astro-ssg --help.`)
}
