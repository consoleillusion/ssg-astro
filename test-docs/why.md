# Why SRS
<!--raw-typst <why> -->


Status: **Implemented**, except where a use names a planned feature.

## The problem


Almost every application needs the same backend: tables, an API over them,
accounts, and rules for who may read and change which rows. Each time, someone
writes it again by hand. That work is slow, repetitive, and where most security
mistakes are made: a forgotten ownership check, a list endpoint that leaks
private rows, passwords stored badly, an API that is only safe behind a TLS
setup nobody maintains.

Existing databases have the same gap from the other side. The data is there,
but giving another program, a team or the public safe access to it means
building and securing an API around it first.

## What SRS does


SRS turns JSON Schema files into a complete, secured backend. From the schemas
alone it creates the database tables, relations and views, migrates the
database as the schemas change, and serves a standard JSON:API over it with
user accounts, per-row access control, sharing, roles and an audit log. Nothing
is written per resource.

It runs as one process with an embedded SQLite database, so it needs no other
service. It is secure without TLS: every request is encrypted to a server key
the client has pinned, and every request after login is signed by a key only
the user's password unlocks.

## Benefits


- **No backend code.** Add a schema file and get a table, migrations and a full
  JSON:API resource: list, filter, sort, paginate, include related rows,
  create, update, delete and manage relationships.
- **Secure by default.** New rows are private to their owner. Rows a caller
  cannot read look like rows that do not exist. Opening a resource up, to the
  public, to signed-in users, to named users and groups, or to a role, is one
  line of schema.
- **Secure without TLS.** The Noise transport encrypts and authenticates every
  request, so SRS is safe on internal networks, home labs and devices where
  certificates are impractical ([Transport](#transport)).
- **Passwords never leave the client.** OPAQUE means the server never sees a
  password, and a stolen database cannot be used to guess passwords offline
  ([Accounts and login](#accounts)).
- **Accountable changes.** Every write is signed by the user's key and kept, so
  who changed what can be proved later from the database alone, even to
  someone who does not trust the server ([Signed requests](#requests)).
- **Standard API.** JSON:API 1.0 means existing clients and tools work, and
  every resource behaves the same way.
- **One source of truth.** The schemas generate the database, the API, the
  migrations, the TypeScript types and the catalog, so none of them drift.
- **Simple to run.** One process, one database file, settings in environment
  variables. No database server, identity provider or certificate authority is
  needed.
- **Grows with the project.** A hosted or server database can replace the
  embedded file by setting a URL and a token ([Implementation plan](#implementation)), and the server
  will become a single binary.

## Uses


- **Scaffolding a new application.** Write the schemas, run `init` and `serve`, and
  the backend is done: a modern, standardised, secure JSON:API with
  accounts, ready for a web or mobile front end. The same server carries the
  project from prototype to production without a rewrite.
- **An API over an existing database.** Import the tables of a database as
  schemas ([Existing databases](#existing-databases)), keeping their keys; SRS adds its own columns,
  tables and views and serves the data, private, shared or public, with access
  control from the first request. SQLite sources today.
- **Internal tools and home labs.** Inventory, booking, asset and runbook tools
  on a local network, without setting up TLS.
- **Devices and sensors.** Give each device its own account; readings arrive
  encrypted and signed, and each can be traced to the device that sent it.
- **Records that must be accountable.** Approvals, inspections, timesheets,
  maintenance logs, invoices: each entry is signed by the person who made it,
  and the signature can be checked later from the database alone.
- **Sharing data between teams or organisations.** Owners share individual rows
  with users or groups, read-only or editable, and every change is audited.
- **Publishing a dataset.** Anyone can read; only holders of an editor role can
  change it (the `public-catalog` template).
- **AI agents.** The catalog describes every resource well enough for a model to
  write valid requests; each agent gets its own account, and every action it
  takes is signed and attributable. Models can also write schemas, and the
  meta-schema tells them exactly what is wrong.
- **A backend inside a Bun application.** `createApp` mounts the same API in an
  existing program.
- **Learning.** A working, tested example of OPAQUE, Noise, request signing and
  row-level access control.

## What SRS is not for


- **Custom business logic in the server.** There are no hooks for code that runs
  on a write; logic lives in clients or in other services.
- **Analytics.** Queries are the JSON:API filters, not arbitrary SQL.
- **Many server processes on one SQLite database.** One process serves one
  database file ([Operations](#operations)).
- **Live updates.** There are no subscriptions or push; clients poll.
- **Web pages delivered over an untrusted network.** A browser client must load
  its code from a trusted origin ([Threat model](#threat-model)).
