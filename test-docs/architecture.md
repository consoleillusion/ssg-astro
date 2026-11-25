# Architecture
<!--raw-typst <architecture> -->


Status: **Implemented** in TypeScript on Bun, including the Noise transport
([Transport](#transport)). The Rust implementation is **Specified** ([Implementation plan](#implementation)).

## Generation


```text
schema files ─► loadSchemas ─► deriveSchemas ─► buildSchema ─┬─► views
                                                              ├─► migrations
                                                              └─► API registry
```

- `loadSchemas` reads `.json`, `.yaml` and `.yml` files, resolves `$ref`, and
  always adds the system schemas.
- `deriveSchemas` turns relation declarations into foreign-key columns, join
  tables and inferred inverse relations.
- `buildSchema` produces the ordered table definitions, views, triggers and
  indexes.
- `planMigration` compares the built schema with the recorded database state
  ([Migrations](#migrations)).

## Runtime


A request passes through these layers in order:

1. **Transport.** Request limits and security headers, then either the Noise
  channel, which decrypts and checks the request signature ([Transport](#transport),
  [Signed requests](#requests)), or a bearer session check in the bearer transport ([HTTP API](#http-api)).
1. **Guard.** Resolves the resource, the operation and the caller's roles, and
  refuses writes to read-only views.
1. **Handlers.** Generic JSON:API handlers read from generated views and write to
  base tables, applying access rules centrally ([Access control](#access-control)).
1. **Audit.** Audited writes add an `audit_log` row in the same transaction,
  together with the retained request signature.

The Noise layer turns an encrypted envelope into an ordinary request and hands
it to the same application, so resource routes do not depend on the transport.

## Storage


One SQLite-compatible database file (Turso), opened by one process.
PostgreSQL and MySQL are planned once Rust owns storage ([Implementation plan](#implementation)). Users,
OPAQUE records, identity public keys, login records, session certificates,
retained signatures and the audit log are stored there. Channel keys and replay
windows are held in memory only.

## Module boundaries


Generation, storage, HTTP, transport and accounts are separate modules. The
transport knows nothing about resources; resource handlers know nothing about
encryption; the account layer is the only code that touches OPAQUE and identity
keys.

These boundaries are also the units of replacement: the server is written in
TypeScript and is replaced by Rust one module at a time, in the order and with
the checks given in [Implementation plan](#implementation).
