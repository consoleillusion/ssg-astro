# Development
<!--raw-typst <ref-development> -->


Status: **Implemented**.

## Requirements

- Bun 1.4 or newer;
- a writable folder for the SQLite database.

## Running the CLI


In this repository the CLI is run as `bun src/cli.ts <command>`. Where SRS is
installed as a dependency of another project, it is `bunx srs <command>`. The
book names commands by their name alone (`init`, `serve`, `console`); the CLI
prints its own correct invocation in its help and messages
(`bun src/cli.ts --help`).

| **Command** | **Does** |
| --- | --- |
| `init <schemas…>` | Generate migrations, types and keys from schema folders ([Migrations](#migrations)). |
| `serve` | Apply migrations and serve the API. |
| `migrate` | Apply migrations without serving, to the embedded file or the remote database. |
| `console` | Serve the browser console ([Console](#ref-console)). |
| `import <file.db>` | Write schemas for an existing SQLite database; `--data --owner <username>` copies its rows ([Existing databases](#existing-databases)). |
| `backup <file>`, `restore <file>` | Take or restore a verified backup ([Operations](#operations)). |
| `verify-signatures` | Check every retained request signature. |
| `rotate-keys` | Start a server key rotation ([Server key rotation](#server-key-rotation)). |


## Trying it


```bash
bun install
bun run try
```

`bun run try` sets up a throwaway server on the sample schemas in
`src/schema`, starts it and the browser console ([Console](#ref-console)) configured for
each other, and prints a link to open. Keys, data and migrations are kept in
`.try/`; delete that folder to start again. Add `--host 0.0.0.0` to open the
console from another machine.

## Running a server by hand


These are the steps `bun run try` performs, run from the repository root:

```bash
# 1. Generate migrations and keys from a schema folder.
bun src/cli.ts init src/schema

# 2. Put the two printed secrets in .env, and allow the console's origin.
#    init also prints the fingerprint (srs1:…) that clients pin.
cat >> .env <<'END'
OPAQUE_SERVER_SETUP=<printed by init>
SRS_SERVER_KEYS=<printed by init>
SRS_CORS_ORIGINS=http://127.0.0.1:5735
END

# 3. Start the server (it listens on port 5734).
bun src/cli.ts serve

# 4. In another terminal, start the console and open http://127.0.0.1:5735.
bun src/cli.ts console
```

`init` writes `.srs/migrations/`, `.srs/config.json` and `.srs/types.ts`, and
never replaces keys that are already set. `serve` refuses to start when the
schemas no longer match the recorded fingerprint, so run `init` again after a
schema change. `.env.example` lists every setting; [Deployment](#ref-deployment) explains
them. `.env` is git-ignored: never commit it.

## Commands


For developing the library itself:

```bash
# write a migration for any schema change
bun run db:generate

# apply migrations
bun run db:migrate

# reset the development database and migration baseline
bun run db:reset

# run all tests (`bun run test` generates the migrations first; plain `bun test`
# needs `bun run db:generate` once, because .migrations is git-ignored)
bun test

# type-check
bun run typecheck

# check the generated API reference builds without warnings
bun run docs:check

# run the API server with watch mode
bun run dev

# run the API server once
bun run start
```

## Database and migrations

The database file is `DB_PATH` (default `.db`). `bun run db:generate` writes a
migration into `.migrations/<timestamp>_<name>/migration.sql` and records what
the database now contains in `.migrations/schema-state.json`. Applied migrations
are immutable. Do not edit the generated files by hand.

`bun run db:generate`:

1. loads and builds the schema;
1. compares the tables, triggers and views with the recorded state;
1. writes a migration with the difference, or nothing if there is none:
  new tables are created, a changed table is rebuilt keeping the rows of the
  columns it still has, and removed tables are dropped;
1. drops and recreates views and triggers around any table change, because
  SQLite checks them when a table is renamed;
1. updates the recorded state.

`bun run db:migrate` applies the migrations not yet recorded in the `__migrations`
table. Each runs in one transaction with foreign keys off, so rebuilding a
table does not cascade deletes into its children.

Running it twice with unchanged schemas must not create a second migration.

`bun run db:migrate` applies pending migrations. Running it twice must succeed.

`bun run db:reset` removes the development database and migration baseline. Use
it only when you intentionally want to rebuild from scratch.

### Foreign keys

SQLite disables foreign-key enforcement unless it is enabled per connection.
The application enables it in `src/helper/loadDb.ts`:

```sql
PRAGMA foreign_keys = ON
```

The test harness does the same after connecting. Without it, `ON DELETE SET NULL`, `ON DELETE RESTRICT`, and owner-to-user checks would not run.

## Tests

```bash
bun test
```

The suite includes:

- schema building, relation derivation, views, custom DDL, and migrations;
- idempotent generation and migration application;
- `x-exposed` behavior for tables, columns, relations, and join tables;
- owner column injection, user foreign key, index, validation, and
  `ON DELETE SET NULL`;
- JSON:API documents, queries, writes, `HEAD`, and `OPTIONS`;
- OPAQUE registration, login, sessions, unknown users, expiry, replay, and
  keypair freshness;
- auth route validation and hidden key status;
- access control: visibility, sharing, roles, inheritance, audit, and signing;
- the browser-safe client: auto-login, storage, expiry, signed requests, and
  portability.

Most `spec/` tests create an in-memory Turso database, apply every migration in
sorted order, build the schema, and call the Hono app through
`app.request(...)`. `spec/helpers/test-server.ts` provides the harness;
`spec/helpers/auth-client.ts` provides OPAQUE client helpers.

Tests do not use the development `.db` file, so they can run while the dev
server is open.

### Adding auth coverage

Use the helpers instead of reimplementing OPAQUE:

```ts
import { login, register } from './helpers/auth-client.ts'

const { userId } = await register(app, {
  username: 'alice',
  // email is optional and not part of registration
  password: 'correct horse battery staple',
})

const { sessionKey, finish } = await login(app, {
  username: 'alice',
  password: 'correct horse battery staple',
})
```

For expiry and purge tests, update `key.expires_at` directly through the test
row database.

## Adding a schema

1. Add `src/schema/<name>.yaml` holding a JSON Schema object.
1. Use a unique `title`; it becomes the snake\_case table name.
1. Declare relations under `x-relations`.
1. Run `bun run db:generate`.
1. Inspect the generated migration.
1. Run `bun run db:migrate`.
1. Add seed and API tests if the resource should be user-visible.

The generator injects `id`, `updated_at`, and `owner`, so do not add them unless
you need explicit control.

### Hiding a resource or field

Set `"x-exposed": false` on the table, property, or relation. Hidden targets
automatically hide relations that point at them. Hidden resources are absent
from the catalog, views, queries, mutations, and generic routes.

The `key` table is hidden this way. If you add another hidden table, expose it
through a dedicated service and route in `src/server/app.ts`, before the generic
`/:type` routes.

## Server startup

`src/server/index.ts`:

1. loads `.env`;
1. requires `OPAQUE_SERVER_SETUP`;
1. builds the schema from all system and user schemas;
1. opens the Turso database with foreign keys enabled;
1. creates the Hono app with the built schema, row database, and OPAQUE setup;
1. serves it on `PORT` (default `5734`).

`createApp` accepts an optional `opaqueServerSetup`. Without it, auth routes are
not registered, which keeps auth-free unit tests simple.

## Conventions

- JSON Schema is the source of truth.
- Table and column names are snake\_case.
- IDs are UUIDv7 blobs, exposed as canonical strings.
- Every table has `id`, `updated_at`, and `owner`.
- Generated files are not edited by hand.
- Applied migrations are immutable.
- Auth state is persisted in the key table; no in-memory sessions.
- Auth success bodies are plain JSON; errors use JSON:API.
- Owner references must be users, never groups.
- `key.user` uses `RESTRICT` to preserve key attribution.
- `owner` uses `SET NULL` to preserve rows when a user is deleted.

## Troubleshooting

### `OPAQUE_SERVER_SETUP is required`

Add the variable to `.env` and restart the server.

### Database is locked

The dev server holds the development `.db` file. Tests use `:memory:` and do
not touch it. If you run migration commands while the dev server is open, stop
the server first.

### A migration did not change

Custom DDL only generates a migration when its hash changes. Confirm that the
generated SQL actually differs. Applied migrations are never rewritten.

### Foreign keys are not enforced

Check that the connection executed `PRAGMA foreign_keys = ON`. The app does this
in `loadDb.ts`; custom connections must do it themselves.

### Login always returns 401

Check that:

- the registration flow finished successfully;
- the key row still exists and has not expired;
- the client uses the same password and OPAQUE state;
- `OPAQUE_SERVER_SETUP` did not change between registration and login.

Changing the server setup invalidates existing registration records.
