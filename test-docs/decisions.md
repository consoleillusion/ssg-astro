# Decision log
<!--raw-typst <decisions> -->


Status: **Implemented** for the log itself.

Add a row before changing a design rule. When a rule is replaced, mark its row
**Superseded** and name the row that replaces it.

| **ID** | **Decision** | **Why** |
| --- | --- | --- |
| D001 | JSON Schema is the source of truth | One declarative input generates the database and the API |
| D002 | Generated artifacts are never hand-edited | Regeneration must be safe and repeatable |
| D003 | UUIDv7 blobs, formatted at the API boundary | Sortable ids without exposing storage details |
| D004 | Every table has `id`, `updated_at` and `owner` | Uniform identity, ordering and authorization |
| D005 | Exposed rows carry `visibility`; the default is private | Secure defaults without per-resource code |
| D006 | Ownership is user-only; groups receive shares | A signature must map to one accountable user |
| D007 | `x-exposed: false` removes a resource from every surface | Hiding is a build-time guarantee, not a filter |
| D008 | Reads use generated views; writes use base tables | Embedded relations without request-time joins |
| D009 | Authorization is declarative and central | Avoids divergent per-handler checks |
| D010 | Authored views are read-only and inherit the base read policy | A projection must not widen access |
| D011 | `x-view: true` identifies a view; `x-source` alone does not | Unknown keywords are ignored, so intent must be explicit |
| D012 | Authored views name direct relations and follow only to-one column paths | A view column cannot hold a to-many scalar |
| D013 | OPAQUE handles passwords | Passwords never leave the client and cannot be guessed offline from the database |
| D014 | Persistent account state lives in the hidden `key` table; channel state lives in memory | Logins survive restarts; transport keys are never written to disk |
| D015 | Migrations are deterministic and applied migrations are immutable | Reviewable, replayable database changes |
| D016 | The HTTP surface is generated JSON:API | No per-resource controller code |
| D017 | Hidden rows return `404`, not `403` | Do not reveal that an unreadable row exists |
| D018 | Documentation flows one way: the design book decides behaviour and holds the reference; code carries TSDoc comments; TypeDoc generates the API reference in `doc/`, which is never edited by hand | Nothing is written twice, so nothing drifts |
| D019 | Replaced by D053 | — |
| D020 | Backups run inside the server; restore runs offline | The database file is locked by the process that opens it |
| D021 | One server process per database | The file lock makes a second process impossible |
| D022 | The default transport is a Noise NK channel authenticated by a pinned server key | Secure on networks without TLS; standard, analysed handshake |
| D023 | Every request after login is signed with a session key, then encrypted | Accountability to third parties, which channel encryption alone cannot give |
| D024 | Each user has an Ed25519 identity key wrapped under the OPAQUE export key; it certifies session keys | The server cannot forge a user's signatures, and any device with the password can sign |
| D025 | Login is bound to the channel by an HMAC of the handshake hash under the OPAQUE session key | A login cannot be relayed through another channel, and a session key cannot be swapped in transit |
| D026 | Strict mode: under `noise`, nothing but the handshake, key bundle and health routes is served in the clear | No downgrade to an unencrypted route |
| D027 | Retired and revoked keys, certificates and retained signatures are never deleted; users that own keys are not deleted | Retained signatures must stay verifiable |
| D028 | The protocol joins are specified in this book before code is written, and the code follows the book | The joins between standard parts are where protocol bugs occur |
| D029 | SRS is completed and stabilised in TypeScript first; that implementation is the reference | Settle the protocol and API where change is cheap, and give Rust something to be checked against |
| D030 | Rust replaces the server one module at a time, inside the Bun process through Node-API, each behind an `SRS_IMPL_<PIECE>` switch | The database lock rules out two processes; SRS keeps working at every step and a faulty piece can be switched back |
| D031 | Every replaceable piece has a language-neutral conformance suite that both implementations must pass, plus differential tests while both exist | Equivalence is proved by tests, not assumed |
| D032 | The wire format is frozen and versioned before Rust replaces any protocol code | Two implementations can only agree on a fixed target |
| D033 | The client's API stays TypeScript; its cryptography may use the WebAssembly build of the Rust protocol crate | Clients must be TypeScript or WebAssembly; one protocol implementation on both sides removes a class of mismatch |
| D034 | Pluggable databases are added only after Rust owns storage | The dialect layer is written once, in the final implementation |
| D035 | Rust pieces use vetted libraries for every primitive: `opaque-ke`, `snow`, `ed25519-dalek`, RustCrypto | Rust is chosen because these exist; no primitive is written by hand |
| D036 | Work is numbered by semantic version: a series is a minor version, a task is a patch version, and each finished task is tagged; `v1.0.0` is the stable TypeScript release | Task ids are also release ids, so the roadmap, the code and the tags name work the same way |
| D037 | Signed structures use fixed binary layouts with a version tag, or length-prefixed fields, never a general serialisation format | Fixed layouts are canonical by construction; no library, and nothing for two implementations to serialise differently |
| D038 | Over the Noise transport, account routes live under `/account` and exist only inside a channel | Keeps the bearer flows unchanged and impossible to reach the new protocol by accident |
| D039 | A certificate's `issued_at` must be within 5 minutes of the server clock; the server records when it accepted each certificate | A stolen identity key cannot backdate a certificate to before a revocation |
| D040 | Strict mode answers every request outside a channel with `426 Upgrade Required` | One unmistakable answer, whatever the request carried |
| D041 | `x-append-only: true` generates triggers that reject `UPDATE` and `DELETE`; `audit_log` uses it | The audit log is append-only in the database, not only through the API |
| D042 | Schema files are checked against a meta-schema that rejects unknown keywords | A typo must fail loudly instead of silently changing behaviour |
| D043 | Metrics are served on a separate listener bound to `127.0.0.1` | Metrics never reach the network, under either transport |
| D044 | Admin password resets are on by default and can be turned off with `SRS_ALLOW_RESET=false` | Recovery is expected by most deployments; the trade-off is recorded in [Forgotten password](#recovery) |
| D045 | Server keys rotate through a transition statement signed by the old key, with a stop date; both keys work until then | Pinned clients move without manual repinning, and a stolen-key forgery is no worse than the theft itself |
| D046 | The protocol is checked by published test vectors, attack tests, conformance suites and real use; there is no formal model or outside review at this stage | SRS is grassroots: a working implementation, checked over time, matters more than ceremony |
| D047 | Conformance fixtures are frozen files checked by hand; no second implementation is kept to produce them | Fewer moving parts and no extra language; published vectors still anchor the cryptography |
| D048 | An existing database is imported as schemas plus a copy of its rows, not served in place | SRS needs its own columns and tables on every resource; adding them to a live database other programs use could break them, and the source stays read-only |
| D049 | The database is chosen by `SRS_DATABASE_URL` and `SRS_DATABASE_TOKEN`; embedded SQLite is the default | One setting to move to a hosted database, and no external service needed to start |
| D050 | The `console` command serves a separate page on its own port, reaching the server through CORS | The API server serves no HTML, and the page is the same client any browser application would use |
| D051 | JSON:API 1.1, Dhall schemas and post-quantum cryptography come after the Rust migration | Each is easier to build once, in Rust, than twice; post-quantum is a new wire format and so v2.0 |
| D052 | Post-quantum changes are hybrid, never post-quantum alone | The post-quantum algorithms are young; hybrid keeps today's security if they are broken and adds protection if they are not |
| D053 | Sign-in is built-in OPAQUE accounts only; there is no external identity provider | SRS must run with no other service, and provider tokens are bearer tokens that cannot sign requests |
| D054 | A property marked `x-primary` replaces the generated `id`, and an imported table keeps its own key | Other programs and existing rows keep their ids, and the key lives in the schema, so building is repeatable |
| D055 | HTTP conformance cases drive a server process through the Noise channel and select only stable values | They check any implementation the way a client sees it, and stay valid however ids and times are generated |
| D056 | The wire format is frozen at v1: every protocol message, label and signed layout in Part III and the bearer signing headers | Clients and a future Rust server can rely on it; a change from now on is a new version with its own labels, and v1 keeps working beside it |
| D057 | Linking to a row the writer can read but may not link to is 403; to a row they cannot read, 404 | The same rule as changing a row: never pretend a visible row does not exist, never reveal an invisible one |
| D058 | A remote Turso database is supported now, in TypeScript, not after the Rust migration | The quiz site deploys on Vercel with Turso; the embedded file stays the default |
| D059 | Serverless deployments use the bearer transport over the platform's HTTPS | A Noise channel's keys and replay window live in one process's memory, which serverless platforms do not keep; TLS gives the same protection there |
| D060 | The server reads rows from base tables, never through the generated views | SQLite (and Turso) cannot use a table's indexes for a condition on a view's converted columns, so every lookup read every row; the views stay for people reading the database directly |
| D061 | Encrypted fields use a random key per row, sealed to each reader's X25519 key; each user's private key is wrapped under their OPAQUE export key | Rows can be shared without sharing a user's other data, and a password change rewraps one key instead of re-encrypting everything |
| D062 | Markdown is the source format for design chapters; `index.typ` is PDF layout only and renders the Markdown through cmarker | One source of truth works directly with static site generators, while keeping the PDF's Typst design |
| D063 | The design book has one Typst file, `design/index.typ`, which also holds the brand; there is no separate `brand.typ` | One entry point is easier to build and change, and the brand cannot drift from the title page that uses it |
