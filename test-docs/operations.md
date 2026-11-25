# Operations
<!--raw-typst <operations> -->


Status: **Implemented**.

## One process per database


The database file is locked by the process that opens it, so a second process
cannot open it. SRS runs one process per database and scales up, not out. This
holds for every database backend until shared channel and replay state is
designed ([Implementation plan](#implementation)).
Replay windows, channel keys and the general request rate limit live in that
process's memory.

## Setup


The `init <schemas>` command generates migrations, records the schema fingerprint, and
creates the secrets that do not exist yet: the OPAQUE server setup
(`OPAQUE_SERVER_SETUP`) and, for the Noise transport, the server key bundle
(`SRS_SERVER_KEYS`). It prints the server key fingerprint to
give to clients. The `serve` command applies migrations and starts the server.

## Secrets


The OPAQUE server setup and the server key bundle are kept outside the
database, in environment variables or files, and backed up separately. A
database restored without the OPAQUE setup cannot log anyone in; a server
started with a different key bundle is rejected by every pinned client.

## Network placement


- Under `noise`, SRS may face the network directly. A reverse proxy is
  optional and cannot read traffic.
- Under `bearer`, SRS must sit behind TLS, usually a reverse proxy.
- Behind a proxy, `SRS_TRUSTED_PROXY_HOPS` tells SRS how many proxies to trust,
  and the client address is read from `X-Forwarded-For` counting from the
  right, so a client cannot choose its own address.

## Limits and observability


- Request bodies are limited (`SRS_MAX_BODY_BYTES`), at the socket and in the
  application.
- A per-client request rate limit applies to every route except health checks.
- `/healthz` reports the process is up; `/readyz` also queries the database.
- With `SRS_METRICS_PORT` set, a second listener on `127.0.0.1` serves
  `/metrics` in the Prometheus text format: requests by method, route pattern
  and status; request duration histograms; login successes and failures; and
  the age of the last backup. It is bound to loopback so it is never reachable
  from the network; a local agent or proxy scrapes it.
- Each request writes one JSON log line without the query string or body. Under
  `noise`, the logged path is the decrypted one.
- `SIGTERM` stops accepting connections, finishes in-flight requests and closes
  the database.

## Backups


The server takes a consistent copy of the live database on a timer
(`SRS_BACKUP_DIR`), writes it under a temporary name, checks it with
`PRAGMA integrity_check` and for the system tables, and only then renames it
into place. The `restore` command verifies a backup and swaps it in with one rename,
with the server stopped. Backups contain wrapped identity keys and OPAQUE
records; both are useless without the passwords and the OPAQUE setup, but
backups should still be protected like the database.
