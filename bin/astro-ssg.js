#!/usr/bin/env node
// @ts-check
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cac } from "cac"

/**
 * @typedef {{ version: string }} PackageJson
 * @typedef {"sakura" | "milligram" | "skeleton"} ClasslessTheme
 * @typedef {{ dir?: string, noDefaultPage: boolean, classless: ClasslessTheme | null }} InitOptions
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

/** @type {readonly [number, number, number]} */
const MINIMUM_NODE = [22, 23, 4]
/** @type {readonly string[]} */
const INDEX_FILES = ["index.astro", "index.html", "index.md", "index.mdx"]
/** @type {readonly ClasslessTheme[]} */
const CLASSLESS_THEMES = ["sakura", "milligram", "skeleton"]
const DEFAULT_CLASSLESS_THEME = "sakura"
const TEMPLATE_VERSION = "2"
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
const MARKER_PATH = path.join(CACHE_DIR, ".no-default-page")
const CLASSLESS_MARKER_PATH = path.join(CACHE_DIR, ".classless")
const TEMPLATE_VERSION_PATH = path.join(CACHE_DIR, ".template-version")

/** @returns {[number, number, number]} */
const nodeVersionTuple = () =>
  (([major = 0, minor = 0, patch = 0]) => [major, minor, patch])(
    process.versions.node.split(".").map(Number)
  )

const isNodeSupported = () =>
  (([major, minor, patch]) =>
    (([requiredMajor, requiredMinor, requiredPatch]) =>
      major > requiredMajor ||
      (major === requiredMajor &&
        (minor > requiredMinor || (minor === requiredMinor && patch >= requiredPatch)))
    )(MINIMUM_NODE)
  )(nodeVersionTuple())

const checkNodeVersion = () =>
  RUNNING_WITH_BUN || isNodeSupported()
    ? undefined
    : fail(`Node.js ${MINIMUM_NODE.join(".")} or newer is required; found ${process.versions.node}.`)

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

/** @param {string} serveDir */
const assertCacheIsSafe = (serveDir) =>
  ((cache, served) =>
    served === cache ||
    served.startsWith(`${cache}${path.sep}`) ||
    cache.startsWith(`${served}${path.sep}`)
      ? fail("The cache directory and the served directory must not contain each other. Set ASTRO_SSG_CACHE somewhere else.")
      : undefined
  )(path.resolve(CACHE_DIR), path.resolve(serveDir))

/** @param {string} serveDir @returns {boolean} */
const hasIndexPage = (serveDir) =>
  INDEX_FILES.some((file) => fs.existsSync(path.join(serveDir, file)))

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
  hasIndexPage(serveDir)
    ? "Found an index page; / will serve it."
    : noDefaultPage
      ? "No index page found; / will return 404 (default page disabled)."
      : "No index page found; / will show a page describing the supported file types."

/** @param {boolean} noDefaultPage */
const setDefaultPageMarker = (noDefaultPage) =>
  noDefaultPage
    ? fs.writeFileSync(MARKER_PATH, "")
    : fs.rmSync(MARKER_PATH, { force: true })

/** @param {ClasslessTheme | null} theme */
const setClasslessMarker = (theme) =>
  theme
    ? fs.writeFileSync(CLASSLESS_MARKER_PATH, theme)
    : fs.rmSync(CLASSLESS_MARKER_PATH, { force: true })

/** @returns {ClasslessTheme | null} */
const readClasslessMarker = () => {
  try {
    const value = fs.readFileSync(CLASSLESS_MARKER_PATH, "utf8").trim().toLowerCase()
    if (value === "") return DEFAULT_CLASSLESS_THEME
    return isClasslessTheme(value) ? value : null
  } catch {
    return null
  }
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

/** @param {string} serveDir @param {InitOptions} options */
const initAt = (serveDir, options) =>
  ( assertCacheIsSafe(serveDir)
  , console.log(`copying template to ${CACHE_DIR}`)
  , fs.rmSync(CACHE_DIR, { recursive: true, force: true })
  , fs.mkdirSync(CACHE_DIR, { recursive: true })
  , fs.cpSync(templateDir, CACHE_DIR, { recursive: true })
  , fs.writeFileSync(TEMPLATE_VERSION_PATH, TEMPLATE_VERSION)
  , fs.mkdirSync(path.dirname(PAGES_DIR), { recursive: true })
  , removePath(PAGES_DIR)
  , fs.symlinkSync(serveDir, PAGES_DIR, process.platform === "win32" ? "junction" : "dir")
  , console.log(`serving ${serveDir} as ${PAGES_DIR}`)
  , setDefaultPageMarker(options.noDefaultPage)
  , setClasslessMarker(options.classless)
  // Create default index.html if no index page exists and default page is not disabled
  , (() => {
      if (!options.noDefaultPage) {
        const indexFiles = ['index.astro', 'index.html', 'index.md', 'index.mdx']
        const hasIndex = indexFiles.some(f => fs.existsSync(path.join(serveDir, f)))
        if (!hasIndex) {
          /** @type {string[]} */
          const pageFiles = []
          try {
            /** @param {string} dir */
            const walk = (dir) => {
              const entries = fs.readdirSync(dir, { withFileTypes: true })
              for (const e of entries) {
                if (e.name.startsWith('.')) continue
                if (e.name === 'node_modules') continue
                if (e.isDirectory()) walk(path.join(dir, e.name))
                else if (e.isFile()) {
                  const ext = path.extname(e.name)
                  if (['.astro','.html','.md','.mdx'].includes(ext)) pageFiles.push(e.name)
                }
              }
            }
            walk(serveDir)
          } catch {}
          if (pageFiles.length > 0) {
            const links = pageFiles.map(f => {
              const base = path.basename(f, path.extname(f))
              const route = base === 'index' ? '/' : `/${base}`
              return `<li><a href="${route}">${f}</a></li>`
            }).join('\n')
            const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/><title>ssg-ssg Default page</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:1rem;line-height:1.6}h1{margin-top:0}.files{padding-left:1.5rem;margin-top:1rem}a{color:#0066cc;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><h1>Default page served</h1><p>No index page was found. Default page is being served with HTTP status 200.</p><p>This server accepts these file types as pages: <code>.astro</code>, <code>.html</code>, <code>.md</code>, <code>.mdx</code></p><p>The following pages exist in this directory:</p><ul class="files">${links}</ul></body></html>`
            fs.writeFileSync(path.join(serveDir, 'index.html'), html)
            console.log(`Created default index.html at ${serveDir}`)
          }
        }
      }
    })()
  , console.log(indexMessage(serveDir, options.noDefaultPage))
  , undefined
  )

/** @param {InitOptions} options */
const init = (options) =>
  ((serveDir) =>
    ( checkNodeVersion()
    , initAt(serveDir, options)
    )
  )(resolveServeDir(options.dir))

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
    ? (console.log("No current template cache found; initializing it for this directory."), initAt(serveDir, options))
    : ((linkedDir) =>
        fs.realpathSync(serveDir) !== linkedDir
          ? (console.log(`Cache is configured for ${linkedDir}; serving ${serveDir} instead.`), initAt(serveDir, options))
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
        : run
          ( manager.command
          , manager.devArgs(astroArgsFromOptions(options))
          , { cwd: CACHE_DIR
            , env
            , shell: manager.shell
            }
          ).then((exitCode) => {
            process.exitCode = exitCode
          })
    ))

/** @param {ServeOptions} options @returns {Promise<void>} */
const serve = async (options) =>
  (async (serveDir) =>
    ( checkNodeVersion()
    , assertCacheIsSafe(serveDir)
    , ensureInitialized(options, serveDir)
    , await runServe(packageManager(), serveEnv(options), options)
    )
  )(resolveServeDir(options.dir))

const cli = cac("astro-ssg")

cli
  .command("init [dir]", "Copy the Astro template to the cache and link [dir] as its src/pages directory")
  .option("--no-default-page", "Do not provide the missing-index page at /")
  .option("--classless [theme]", `Style every route with a classless stylesheet (${CLASSLESS_THEMES.join(", ")})`)
  .action(
    /** @param {string | undefined} dir @param {{ defaultPage?: boolean, classless?: boolean | string }} options */
    (dir, options) =>
      init
        ( { dir
          , noDefaultPage: options.defaultPage === false
          , classless: normalizeClassless(options.classless)
          }
        )
  )

cli
  .command("serve [dir]", "Install dependencies and start the Astro dev server for [dir]")
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
          , classless: normalizeClassless(options.classless) ?? readClasslessMarker()
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

;(parsed.args.length === 0 && !cli.matchedCommand)
  ? cli.outputHelp()
  : undefined
