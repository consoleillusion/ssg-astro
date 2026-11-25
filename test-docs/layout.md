# Repository layout
<!--raw-typst <layout> -->


Status: **Implemented**, except the folders marked *planned*.

```text
src/
  auth/            OPAQUE service, /key routes, signing, limits, keys
    service/         registration, login and key handlers
  client/          browser-safe TypeScript client
  console/         the `console` command: the browser page and its server
  db/              schema loading, derivation, building, views, migrations,
                   backup and restore
    build/           columns, relations, DDL, plans, views
    derive/          join tables and inverse relations
  helper/          database connection
  schema/          sample user schemas
    system/          system schemas, always loaded
  seed/            sample JSON:API documents for tests
  server/          Hono app, transport layer, registry, queries, mutations
    app/             routes, guard, CRUD and relationship handlers
    mutations/       write-document parsing and row writes
  cli.ts           `srs` command: init, serve, console, backup, restore and more
  commands.ts      the commands behind the CLI
  index.ts         public library exports
scripts/           `bun run try`, and conformance-case.ts for writing new cases
spec/              end-to-end tests through the app, and the browser test
  helpers/         test server, sign-in and client helpers
  unit/            unit tests by module
design/            this book: one .md file per chapter, index.typ, build.sh
templates/         example schema folders for common patterns
doc/               generated API reference (bun run docs); not committed
conformance/       language-neutral conformance suites
  protocol/          protocol cases by topic
crates/            planned: Rust crates (v1.1)
.github/workflows/ CI
Containerfile      container image (Podman or Docker)
.env.example       every setting, with defaults
AGENTS.md          entry point for agents; CLAUDE.md is a copy
```

Generated and local files are not committed: `node_modules/`, `.migrations/`
(the library's own development migrations), databases, `.env`,
`dist/srs.pdf`, `doc/`. The HTML pages in `static_site/` are generated from
the Markdown chapters and are committed for hosting. A project using SRS
commits its `.srs/` folder, written by the `init` command.

## Design book files


| **File** | **Contents** |
| --- | --- |
| `index.typ` | The only Typst file: brand, title page, styles, parts and the order of chapters; renders each chapter with cmarker |
| `build.sh` | Compiles `index.typ` to `dist/srs.pdf` |
| `why.md`, `introduction.md`, `goals.md`, `stack.md`, `architecture.md` | Part I |
| `schema.md`, `migrations.md`, `authored-views.md`, `existing-databases.md`, `access-control.md`, `http-api.md` | Part II |
| `threat-model.md`, `transport.md`, `accounts.md`, `requests.md`, `lifecycle.md`, `encryption.md` | Part III |
| `operations.md`, `implementation.md`, `roadmap.md` | Part IV |
| `contributing.md`, `layout.md`, `decisions.md`, `status.md` | Part V |
| `ref-schema.md`, `ref-data-model.md`, `ref-api.md`, `ref-auth.md`, `ref-deployment.md`, `ref-development.md`, `ref-console.md`, `ref-branding.md` | Part VI |
