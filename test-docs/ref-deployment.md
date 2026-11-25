# Deployment
<!--raw-typst <ref-deployment> -->


Status: **Implemented**.

How to run SRS in production: one process, its settings, a reverse proxy,
backups, and restore.

## One process per database

The database file is locked by the process that opens it. A second process on
the same file, including the `backup` command, fails to start rather than risk
corrupting it. Run one SRS instance per database; scale a single instance
up rather than out. The container image declares `/data` and `/backups` as
volumes for this reason.

## Container

The image is built from `Containerfile`. In this repository, with the chat
template as the project:

```bash
bun run cli -- init templates/chat     # writes .srs/ and prints the settings
# put the printed OPAQUE_SERVER_SETUP and SRS_SERVER_KEYS lines in .env
podman build -t srs .
podman run -p 5734:5734 --userns=keep-id \
  -v "$PWD":/project:ro,z -v srs-data:/data -v srs-backups:/backups srs
```

For a project of your own, run `init` and the `run` command in the project
folder, and point the build at the SRS checkout:
`podman build -t srs -f /path/to/srs/Containerfile /path/to/srs`.

- `-v "$PWD":/project` is required: it gives the container your schema files,
  the `.srs/` folder written by `init`, and `.env`, which the server reads from
  there. Without it the container has no project and stops with
  `Nothing is mounted at /project`.
- `:z` relabels the mount so the container may read it on SELinux systems
  (Fedora, RHEL), and `--userns=keep-id` runs the server as your own user under
  rootless Podman, so it can read the files you own. Without them the server
  stops with `Cannot read /project/.srs/config.json`. Docker takes the same
  command without `--userns=keep-id`.
- `srs-data` and `srs-backups` are named volumes that keep the database and
  backups when the container is replaced.

The image runs as a non-root user, sets `DB_PATH=/data/srs.db` and
`SRS_BACKUP_DIR=/backups`, reports health through `/readyz`, and shuts down
cleanly on `SIGTERM` (`podman stop`).

## Serverless, with a remote database

On a platform with no long-running process and no local disk, such as Vercel,
SRS runs as a request handler (`srs/serverless`) over a remote Turso database,
on the bearer transport over the platform's HTTPS (D059).

```bash
bun src/cli.ts init schemas              # also writes .srs/schemas.json
export SRS_DATABASE_URL='libsql://<database>.turso.io'
export SRS_DATABASE_TOKEN='<token>'      # turso db tokens create <database>
bun src/cli.ts migrate                   # before each deploy that changes schemas
```

```ts
// In an Astro site: src/pages/api/[...path].ts
import schemas from '../../../.srs/schemas.json'
import { createHandler } from 'srs/serverless'
const handle = await createHandler({ schemas, basePath: '/api' })
export const ALL = ({ request }: { request: Request }) => handle(request)
```

Set `SRS_DATABASE_URL`, `SRS_DATABASE_TOKEN`, `OPAQUE_SERVER_SETUP` and, if
the site is on another origin, `SRS_CORS_ORIGINS` in the platform's
environment. `backup` refuses a remote database: Turso keeps its own backups.

## Settings

All settings are environment variables. `.env.example` lists them with
defaults.

| **Variable** | **Default** | **Meaning** |
| --- | --- | --- |
| `DB_PATH` | `.db` | Database file |
| `PORT` | `5734` | Listening port |
| `MIGRATE_ON_START` | `true` | `false` to apply migrations yourself |
| `OPAQUE_SERVER_SETUP` | none | Server key for built-in accounts; losing or changing it locks every built-in user out |
| `SRS_SERVER_KEYS` | none | Server key bundle for the Noise transport (`srs-keys-v1:` and 64 secret bytes). Changing it breaks every client pinned to its fingerprint |
| `SRS_PREVIOUS_SERVER_KEYS`, `SRS_KEY_TRANSITION` | none | Set together by the `rotate-keys` command during a key rotation; remove both after the stop date |
| `SRS_DATABASE_URL` | none | A remote Turso database (`libsql://…`); unset means the embedded file at `DB_PATH` |
| `SRS_DATABASE_TOKEN` | none | The remote database's access token |
| `SRS_TRANSPORT` | `noise` | `noise` serves everything through the encrypted channel and needs `SRS_SERVER_KEYS`; `bearer` serves routes directly and needs TLS |
| `SRS_RETAIN_READS` | `false` | `true` keeps the signature of every signed read in the audit log, not only reads a resource lists in `x-access.signed` |
| `SRS_ALLOW_RESET` | `true` | `false` turns off admin password resets; a forgotten password then means a new account |
| `SRS_ADMINS` | none | Usernames that always hold the `admin` role |
| `SRS_MAX_BODY_BYTES` | `1048576` | Largest accepted request body |
| `SRS_RATE_LIMIT_PER_MINUTE` | `600` | Requests per client address per minute; `0` turns it off |
| `SRS_TRUSTED_PROXY_HOPS` | `0` | Reverse proxies in front of the server |
| `SRS_CORS_ORIGINS` | none | Comma-separated browser origins allowed to call the API; `*` allows any |
| `SRS_LOG` | `true` | `false` turns off the JSON request log |
| `SRS_BACKUP_DIR` | none | Folder for scheduled backups; unset means no backups |
| `SRS_BACKUP_INTERVAL_HOURS` | `24` | Time between backups |
| `SRS_BACKUP_KEEP` | `7` | Newest backups to keep |


The server refuses to start without `OPAQUE_SERVER_SETUP`, and, in the
`noise` transport, without `SRS_SERVER_KEYS`.

## Behind a reverse proxy

Terminate TLS at the proxy and set `SRS_TRUSTED_PROXY_HOPS` to the number of
proxies in front of SRS (1 for a single proxy). SRS then takes the client
address from the matching entry of `X-Forwarded-For`, counted from the right,
so a client cannot choose its own address by sending the header. With the
default of `0`, every request is attributed to the socket peer, which behind a
proxy is the proxy itself: all users would then share one rate-limit and one
login-throttle bucket.

The proxy should also set its own request timeouts and strip any
`X-Forwarded-For` it did not add.

## Request limits and headers

- Bodies larger than `SRS_MAX_BODY_BYTES` get `413` with a JSON:API error; the
  socket layer refuses them before they are read.
- Every response carries the standard security headers.
- Without `SRS_CORS_ORIGINS`, no CORS headers are sent, so browsers allow only
  same-origin use. Sessions are bearer tokens in the `Authorization` header, not
  cookies, so cross-site request forgery does not apply; CORS is the only
  browser gate.
- Requests over the rate limit get `429` with `Retry-After`. The limit is held
  in memory per process. Login and registration have separate limits that are
  stored in the database.

## Health and logs

- `GET /healthz` answers while the process is up.
- `GET /readyz` also runs a query and answers `503` if the database does not
  respond.
- Each request writes one JSON line to standard output: time, request id,
  method, path (no query string), status, duration in milliseconds, and user id.
  The `X-Request-Id` request header is reused when it is a short token;
  otherwise one is generated, and it is returned on the response.
- On `SIGTERM` or `SIGINT` the server stops accepting connections, finishes
  in-flight requests, and closes the database.

## Backups

Set `SRS_BACKUP_DIR` and SRS writes a consistent copy of the live database every
`SRS_BACKUP_INTERVAL_HOURS`, keeps the newest `SRS_BACKUP_KEEP`, and logs
`{"event":"backup"}` or `{"event":"backup_failed"}`. A backup is taken at startup
only when the newest one is older than the interval.

Each backup is written under a temporary name, opened, checked with
`PRAGMA integrity_check`, confirmed to hold the system tables, and only then
renamed into place, so the folder never contains a half-written file. Copy the
folder off the machine; a backup beside the database does not survive losing the
disk.

With the server stopped, the `backup <file>` command writes one verified copy by hand.

## Restore

```bash
# stop the server first
bun src/cli.ts restore /backups/srs-2026-11-24T07-41-06.218Z.db --force
# start the server
```

`restore` verifies the backup, copies it beside the database, verifies the copy,
and swaps it in with one rename. It refuses without `--force` when a database
already exists. Because the database is locked while the server runs,
restoring into a running server fails instead of corrupting it.

Test a restore before you need one: restore the latest backup on a spare machine
and query it.

Back up `OPAQUE_SERVER_SETUP` separately in a secret store. A database restored
without it cannot log built-in users in.
