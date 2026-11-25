# Implementation plan
<!--raw-typst <implementation> -->


Status: **Specified**; Stage 1 is in progress ([Roadmap](#roadmap)).

## Decision


The tasks for each stage are in [Roadmap](#roadmap): Stage 1 is the series v0.2 to v0.6
and ends with the `v1.0.0` release, Stage 2 is v1.1 and Stage 3 is v1.2.

SRS is finished and stabilised in TypeScript first. The TypeScript server then
becomes the reference implementation, and a Rust server replaces it piece by
piece, each piece proved equivalent before it is switched on. The end state is
a single Rust binary with a pluggable database. The client stays TypeScript.

Building in TypeScript first means the protocol and API are settled where
changes are cheap, and every Rust piece has a working implementation to be
checked against. Replacing piece by piece means SRS works at every step, and a
faulty piece can be switched back.

## Stage 1: stable TypeScript


Build everything specified in this book on the current TypeScript server and
client: the Noise transport ([Transport](#transport)), accounts and identity keys
([Accounts and login](#accounts)), signed requests ([Signed requests](#requests)) and the account lifecycle
([Account lifecycle](#lifecycle)).

The stage is complete when:

- every specified feature is built and every rule has a test;
- the protocol passes the checks in [Status and verification](#status): the published Noise test
  vectors, the attack tests and the conformance suites;
- the wire format is frozen. Every protocol string carries a version
  (`srs-noise-v1`, `srs-req-v1`, `srs-cert-v1` and so on), and a frozen
  version is never changed, only replaced by a new one;
- the conformance suites below exist and the TypeScript implementation passes
  them;
- SRS has run in at least one real deployment without a protocol change.

## Conformance suites


Each replaceable piece has a language-neutral conformance suite: input and
expected-output files in a shared folder (`conformance/<piece>/`), with a
small runner in each language. Both implementations must pass the same files.

- **Protocol:** fixed keys and random values, with the exact bytes of every
  handshake message, envelope, binder, certificate and signature, and of the
  bearer transport's signed requests. Also invalid
  inputs and the error each must produce.
- **Schema engine:** schema folders, with the built schema, generated SQL and
  migration state expected for each.
- **Query compiler:** a resource, a caller and a query string, with the SQL and
  parameters expected.
- **Access decisions:** a row, a caller and an operation, with the decision
  expected.
- **HTTP:** request and response pairs run against a seeded database. These are
  the existing end-to-end tests, rewritten to drive the server over HTTP only,
  so they test any implementation.

In addition, while both implementations of a piece exist, CI runs randomised
differential tests: the same inputs through both, failing on any difference.

## Case format


Each case is one JSON file under `conformance/<suite>/`, in subfolders as
needed:

```json
{ "description": "What the case shows",
  "operation": "encoding.certificate",
  "input": { "sid": "303132…", "issuedAt": 1764000000000 },
  "output": "7372732d…" }
```

- `operation` names what to run. Each implementation keeps a table from
  operation names to its own code (`spec/conformance/operations.ts` in
  TypeScript).
- A case has exactly one of `output` (the expected result) or `error` (the
  expected error code). Error codes are stable strings such as
  `invalid-length`; every implementation reports the same code for the same
  failure.
- Bytes are lowercase hex strings. Integers that fit in 53 bits are JSON
  numbers; wider integers are decimal strings.
- Results are compared as canonical JSON, so field order in an `output` object
  matters and is fixed by the case.

## Operations


| **Operation** | **Input** | **Output** |
| --- | --- | --- |
| `schema.build` | Schemas, and `only`: `user` (default) or `system` | Every table, trigger and view as `{ key, statements }`, in build order. Errors: `several-keys`, `bad-key-type`, `bad-key-format`, `key-and-id`, `unknown-relation-table`, `duplicate-table`, `link-any-without-join`, `invalid-schema`, and others listed in the TypeScript adapter. |
| `schema.migrate` | Schemas `before` and `after` | The migration statements, in order. |
| `query.list` | Schemas, a resource, a viewer (`user`, `roles`, `anonymous`) and a query string | Each SQL statement a list runs, with its parameters; bytes as `{ "hex": … }`. Errors: `bad-query`, `unknown-resource`. |
| `access.decide` | Schemas, rows to insert, and checks of viewer, operation, resource and id | `allow` or `deny` for each check. |
| `http.session` | Schemas, users to register, admins, and steps | For each step: its status and the values at the paths it selects. |


An HTTP session starts the real server as a process (`bun src/cli.ts`, or the
command in `SRS_CONFORMANCE_SERVER`), registers its users through the Noise
channel, and runs each step as one of them, as nobody (`as: null`), or outside
the channel (`clear: true`). A step can `save` a value, such as a new id, and
later steps use it as `{{name}}`; each user's id is saved under their name.
Selected paths are dotted (`data.0.id`); `length` is an array's length, and
`[type=author]` picks the first element with that field. A case selects only
values that are the same on every run, never generated ids or times.

## Fixtures


Fixtures are frozen files. Once a case is committed it changes only when the
protocol or behaviour it pins changes, and that change is reviewed like any
other. New cases may be written by hand or produced by a short script; either
way they are read and checked before they are committed, because an
implementation cannot check itself against output it just produced. Published
vectors, such as the Noise test vectors, are included as cases and name their
source. The TypeScript runner is `spec/conformance.test.ts` and runs with the
rest of the tests; a later implementation must pass the same files.
`bun scripts/conformance-case.ts <case.json> --write` fills in a new case's
result for reading.

## Stage 2: Rust, piece by piece


The database file is locked by the process that opens it, so the Rust and
TypeScript code cannot run as two processes on the same database. During
replacement, Rust code runs inside the Bun process as a native module built
with Node-API (`napi-rs`). Each piece is chosen by a setting,
`SRS_IMPL_<PIECE>=ts|rust`, defaulting to `ts` until the Rust piece has passed
its conformance suite and differential tests, then to `rust`. The TypeScript
version of a piece is deleted one release after the Rust one becomes the
default.

Pieces are replaced in this order. Each is mostly pure logic with a narrow
interface, so each can be swapped without touching the others.

1. **Protocol core** (`srs-protocol` crate): Noise channel, envelope, replay
  window, binder, identity-key wrapping, certificates, request signing. Built
  for Node-API (server) and WebAssembly (client).
1. **Schema engine** (`srs-schema`): loading, deriving and building schemas, and
  planning migrations. Also gives a Rust `init` command.
1. **Query compiler** (`srs-query`): JSON:API query parameters and access rules to
  SQL and parameters.
1. **Access decisions**: owner, visibility, share, role and inheritance checks.
1. **Storage** (`srs-store`): the database connection, transactions and
  migrations. From here on Rust owns the database, and TypeScript reaches it
  only through the native module.
1. **HTTP and accounts** (`srs-server`): the Rust binary takes over the socket,
  routing, OPAQUE handling and the remaining handlers. Bun is no longer needed.
  The result is one static binary.

## Stage 3: pluggable databases


Choosing a database is one setting. With nothing set, SRS uses its embedded
SQLite file and needs no other service; this stays the default.

| **Setting** | **Meaning** |
| --- | --- |
| `SRS_DATABASE_URL` | A remote Turso database (`libsql://…`). **Implemented** in TypeScript (`src/db/remote.ts`), for serverless deployments ([Deployment](#ref-deployment)). Later: `postgres://…` and `mysql://…`. |
| `SRS_DATABASE_TOKEN` | The database's access token, kept out of the URL so it can come from a secret store. |


A remote Turso database came before Rust because the first real deployment
runs on Vercel (D058). Foreign keys are off in every new SQLite session and a
remote session can be replaced between requests, so every write turns them on
first, and every transaction runs on its own session that turns them on before
`BEGIN`.

Only after Rust owns storage, `srs-store` gains a dialect layer for PostgreSQL
and MySQL alongside SQLite. The differences it has to cover are known: JSON
aggregation in views, UUID storage, the `updated_at` triggers, `RETURNING`
(absent in MySQL), and migration planning (SQLite rebuilds tables; the others
can alter them). The schema engine and query compiler conformance suites gain
expected output per dialect.

With a database server, more than one SRS process becomes possible. That needs
replay windows, channel state and rate limits moved to shared storage; until
it is designed, one process per database remains the rule ([Operations](#operations)).

## The client


The client's public API stays TypeScript. Its cryptography is TypeScript
(`@noble/*` and `@serenity-kit/opaque`) during Stage 1. Once `srs-protocol`
passes the protocol conformance suite, the client may use its WebAssembly
build instead, so client and server run the same protocol code. Either way the
client must pass the same suite.

## Libraries


Rust pieces use vetted libraries for every cryptographic primitive: `opaque-ke`
for OPAQUE (the library `@serenity-kit/opaque` is built from, so both sides can
share a cipher suite), `snow` for Noise, `ed25519-dalek`, and the RustCrypto
AEAD and hash crates. `zeroize` wipes secrets from memory after use.
