# Status and verification
<!--raw-typst <status> -->


Status: **Implemented** — kept current with every change.

## Built


- Schema generation, relations, views, deterministic migrations, a meta-schema
  check of every schema file, generated TypeScript types and a descriptive
  catalog.
- The JSON:API, and access control with visibility, sharing, roles,
  inheritance, and an append-only audit log.
- The Noise transport, the default: pinned server keys, the NK handshake,
  sealed requests and responses, replay protection and strict mode.
- Accounts over it: OPAQUE with identity keys, logins bound to the channel,
  session certificates, resume, every request signed and retained, an offline
  signature verifier, and the full account lifecycle, including revocation,
  admin resets, disabling users and server key rotation.
- The bearer transport for TLS deployments.
- Operations: request limits, rate limiting, health checks, request logging,
  metrics, backups and restore, graceful shutdown, CI and a container image.
- The `console` command, a browser page for using a server over the Noise
  transport, and `bun run try`, which starts a server and the console
  together; both are tested in headless Chrome, including without
  `crypto.subtle`.
- Conformance: a protocol suite of frozen fixtures, including the published
  Noise vectors.

## Specified, not built


Everything with state **Next**, **Later** or **Open** in [Roadmap](#roadmap).

## Known gaps in what is built


- In the bearer transport, the session public key sent at login is not bound
  to the OPAQUE exchange, so an active attacker can replace it. The bearer
  transport requires TLS, which prevents this; the Noise transport removes the
  gap by design ([Login](#login)).
- A parent's owner cannot moderate inherited child rows.
- Only SQLite databases can be imported, and only the embedded SQLite
  database can be served (v1.2).
- PDF tables now come from Markdown, so their column widths are generated from
  the table shape instead of the former per-table `columns` settings.

## Open questions


## How the protocol is checked


SRS is checked by working code, tests and use over time, not by outside
review. The transport and account protocol is accepted while all of these
hold:

1. The Noise handshake passes the published Noise test vectors for
  `Noise_NK_25519_ChaChaPoly_BLAKE2s`.
1. Every rule in [Transport](#transport), [Accounts and login](#accounts) and [Signed requests](#requests) has a test, including
  these attacks: replayed, reordered, truncated and cross-channel envelopes;
  responses swapped between requests; a login relayed through a second
  channel; a swapped session key; a certificate from another channel or
  login; a revoked identity key; a downgrade to a clear route; a forged
  key-rotation statement.
1. The protocol conformance suite passes.
1. Every problem found in real use gets a test that would have caught it.
