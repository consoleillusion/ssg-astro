#!/usr/bin/env node
import { spawn, type SpawnOptions } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cac } from "cac"

type PackageJson =
  { version: string
  }

type ServeOptions =
  { noDefaultPage: boolean
  , port: string | null
  , host: string | null
  }

type PackageManager =
  { command: string
  , installArgs: string[]
  , devArgs: (astroArgs: string[]) => string[]
  , shell: boolean
  }

const packageRoot = fileURLToPath(new URL("..", import.meta.url))
const templateDir = path.join(packageRoot, "template")
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
) as PackageJson

const MINIMUM_NODE = [22, 23, 4] as const
const INDEX_FILES = ["index.astro", "index.html", "index.md", "index.mdx"] as const
const RUNNING_WITH_BUN = Boolean(process.versions.bun)

const fail = (message: string): never =>
  (console.error(`astro-ssg: ${message}`), process.exit(1))

const defaultCacheDir = (): string =>
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

const nodeVersionTuple = (): readonly [number, number, number] =>
  (([major = 0, minor = 0, patch = 0]) => [major, minor, patch] as const)(
    process.versions.node.split(".").map(Number)
  )

const isNodeSupported = (): boolean =>
  (([major, minor, patch]) =>
    (([requiredMajor, requiredMinor, requiredPatch]) =>
      major > requiredMajor ||
      (major === requiredMajor &&
        (minor > requiredMinor || (minor === requiredMinor && patch >= requiredPatch)))
    )(MINIMUM_NODE)
  )(nodeVersionTuple())

const checkNodeVersion = (): void =>
  RUNNING_WITH_BUN || isNodeSupported()
    ? undefined
    : fail(`Node.js ${MINIMUM_NODE.join(".")} or newer is required; found ${process.versions.node}.`)

const removePath = (target: string): void =>
  ((result) => result)(
    (() => {
      try {
        return ((stat) =>
          stat.isDirectory() && !stat.isSymbolicLink()
            ? fs.rmSync(target, { recursive: true, force: true })
            : fs.unlinkSync(target)
        )(fs.lstatSync(target))
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        return err.code === "ENOENT" ? undefined : (() => { throw error })()
      }
    })()
  )

const assertCacheIsSafe = (serveDir: string): void =>
  ((cache, served) =>
    served === cache ||
    served.startsWith(`${cache}${path.sep}`) ||
    cache.startsWith(`${served}${path.sep}`)
      ? fail("The cache directory and the served directory must not contain each other. Set ASTRO_SSG_CACHE somewhere else.")
      : undefined
  )(path.resolve(CACHE_DIR), path.resolve(serveDir))

const hasIndexPage = (serveDir: string): boolean =>
  INDEX_FILES.some((file) => fs.existsSync(path.join(serveDir, file)))

const indexMessage = (serveDir: string, noDefaultPage: boolean): string =>
  hasIndexPage(serveDir)
    ? "Found an index page; / will serve it."
    : noDefaultPage
      ? "No index page found; / will return 404 (default page disabled)."
      : "No index page found; / will show a page describing the supported file types."

const setDefaultPageMarker = (noDefaultPage: boolean): void =>
  noDefaultPage
    ? fs.writeFileSync(MARKER_PATH, "")
    : fs.rmSync(MARKER_PATH, { force: true })

const init = (options: { noDefaultPage: boolean }): void =>
  ((serveDir) =>
    ( checkNodeVersion()
    , assertCacheIsSafe(serveDir)
    , console.log(`copying template to ${CACHE_DIR}`)
    , fs.rmSync(CACHE_DIR, { recursive: true, force: true })
    , fs.mkdirSync(CACHE_DIR, { recursive: true })
    , fs.cpSync(templateDir, CACHE_DIR, { recursive: true })
    , fs.mkdirSync(path.dirname(PAGES_DIR), { recursive: true })
    , removePath(PAGES_DIR)
    , fs.symlinkSync(serveDir, PAGES_DIR, process.platform === "win32" ? "junction" : "dir")
    , console.log(`serving ${serveDir} as ${PAGES_DIR}`)
    , setDefaultPageMarker(options.noDefaultPage)
    , console.log(indexMessage(serveDir, options.noDefaultPage))
    , undefined
    )
  )(process.cwd())

const packageManager = (): PackageManager =>
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

const run = (command: string, args: string[], options: SpawnOptions = {}): Promise<number> =>
  new Promise((resolve, reject) =>
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
  )

const normalizePort = (port: unknown): string | null =>
  port === undefined || port === null
    ? null
    : ((value) =>
        /^\d+$/.test(value) ? value : fail("--port must be a number.")
      )(String(port))

const normalizeHost = (host: unknown): string | null =>
  host === undefined || host === null || host === false
    ? null
    : host === true
      ? "0.0.0.0"
      : String(host)

const astroArgsFromOptions = (options: ServeOptions): string[] =>
  [ options.port !== null ? ["--port", options.port] : []
  , options.host !== null ? ["--host", options.host] : []
  ].flat()

const ensureInitialized = (options: ServeOptions): void =>
  !fs.existsSync(path.join(CACHE_DIR, "package.json")) || !fs.existsSync(PAGES_DIR)
    ? (console.log("No template cache found; initializing it for this directory."), init(options))
    : ((serveDir, linkedDir) =>
        serveDir !== linkedDir
          ? (console.log(`Cache is configured for ${linkedDir}; serving ${serveDir} instead.`), init(options))
          : undefined
      )(fs.realpathSync(process.cwd()), fs.realpathSync(PAGES_DIR))

const serveEnv = (options: ServeOptions): NodeJS.ProcessEnv =>
  options.noDefaultPage
    ? { ...process.env, SSG_NO_DEFAULT_PAGE: "1" }
    : { ...process.env }

const serve = async (options: ServeOptions): Promise<void> =>
  ( checkNodeVersion()
  , assertCacheIsSafe(process.cwd())
  , ensureInitialized(options)
  , await ((manager, env) =>
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
    )(packageManager(), serveEnv(options))
  )

const cli = cac("astro-ssg")

cli
  .command("init", "Copy the Astro template to the cache and link the current directory as its src/pages directory")
  .option("--no-default-page", "Do not provide the missing-index page at /")
  .action((options: { defaultPage?: boolean }) =>
    init({ noDefaultPage: options.defaultPage === false })
  )

cli
  .command("serve", "Install dependencies and start the Astro dev server")
  .option("--no-default-page", "Do not provide the missing-index page at /")
  .option("--port <port>", "Port for the dev server")
  .option("--host [host]", "Expose the dev server on the network")
  .action((options: { defaultPage?: boolean, port?: unknown, host?: unknown }) =>
    serve
      ( { noDefaultPage: options.defaultPage === false
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
