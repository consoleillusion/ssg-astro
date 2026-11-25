# Goals
<!--raw-typst <goals> -->


Status: **Implemented**, except the single Rust binary and pluggable databases,
which are **Specified** ([Implementation plan](#implementation)).

## Product goal


Turn a folder of JSON Schema files into a secured backend that anyone can run
with one command, on the internet or on an internal network without TLS.

## Goals


- **Schema is the source of truth.** Tables, relations, views, migrations and API
  resources are derived from schema files.
- **Secure by default.** New resources are private, readable only with a session,
  and not shareable unless opened up.
- **Secure without TLS.** With the Noise transport, every request is encrypted
  and signed, and both ends are authenticated, so SRS is safe on networks where
  TLS is impractical ([Threat model](#threat-model)).
- **Accountable writes.** A signed request can be traced to a key that only the
  user's password unlocks, and that the server cannot forge ([Signed requests](#requests)).
- **Simple to run.** One process, one database file, settings in environment
  variables, no external services required. The end state is a single static
  binary that can also use PostgreSQL or MySQL ([Implementation plan](#implementation)).
- **Deterministic generation.** The same schemas produce the same database objects
  and SQL in the same order.
- **One runtime contract.** Migration generation and the running server use the
  same built schema, so the database and API cannot drift.
- **Hide by construction.** Hidden tables, columns and relations are absent from
  the registry, catalog, queries and responses, not filtered afterwards.
- **Standard parts.** Cryptography comes from published, vetted protocols and
  libraries: Noise, OPAQUE, Ed25519 and ChaCha20-Poly1305. SRS writes only the
  joins between them, and those are specified here.
- **Behaviour is tested.** Tests cover generation, migrations, the API,
  authorization, authentication, the transport and the client.
  Language-neutral conformance suites define correct behaviour for every
  replaceable piece, so any implementation can be checked against them.

## Constraints


- No raw user SQL is executed.
- Passwords never leave the client.
- Generated migrations are not edited by hand; applied migrations are
  immutable.
- The API is JSON:API 1.0.
- `owner` always references `user.id`, never a group.
- Security must not be weakened to adopt a standard or a library. A standard
  option that is weaker than the default stays opt-in and is documented as
  weaker.

## Non-goals


- A general-purpose ORM, SQL console or query builder.
- A policy language beyond the `x-access` model.
- Horizontal scaling on SQLite: one process serves one database
  ([Operations](#operations)).
- Protecting a client whose code is delivered over an untrusted network
  ([Threat model](#threat-model)).
- Treating the existence of a hidden row as public information.
