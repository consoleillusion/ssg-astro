# Accounts and login
<!--raw-typst <accounts> -->


Status: **Implemented** over the Noise transport (`src/auth/channel-accounts.ts`,
`src/protocol/accounts.ts`, `src/client/secure.ts`). The bearer transport's
OPAQUE flows are described in [Authentication routes](#ref-auth).

## Decision


Passwords are handled by OPAQUE (RFC 9807), through `@serenity-kit/opaque`.
Each user also has a long-term Ed25519 *identity key*. Its private half is
stored on the server encrypted under the OPAQUE export key, so only someone who
knows the password can unlock it, on any device, and the server can never use
it.

OPAQUE alone authenticates a password. The identity key adds accountability
that survives a dishonest server ([Signed requests](#requests)), and lets a client resume after a
restart without retyping the password ([Resuming a login](#resume)).

## Keys


| **Key** | **Held by** | **Purpose** |
| --- | --- | --- |
| OPAQUE server setup | server, outside the database | OPAQUE server key; losing or changing it locks every user out. |
| Server key bundle | server, outside the database | Noise static key and server signing key ([Server keys](#server-keys)). |
| Identity key | user; stored wrapped on the server | Signs session certificates; the root of a user's signatures. |
| Wrap key | derived on the client, never stored | `HKDF-SHA256(export_key, info = "srs-identity-wrap-v1")`. |
| Session key | client memory, one per login | Ed25519 key that signs every request ([Signed requests](#requests)). |


The wrapped identity key is
`XChaCha20-Poly1305(wrap_key, random 24-byte nonce, ad = user_id ‖ identity_public, identity_private)`.

## Routes


These routes exist only inside a Noise channel; outside one they answer `404`.
Bodies are plain JSON; binary values are base64url.

| **Route** | **Step** |
| --- | --- |
| `POST /account/registration` | Start registration: `username`, optional `displayName`, `registrationRequest`. Answers `id`, `userId`, `registrationResponse`, `expiresAt`. |
| `PUT /account/registration/:id` | Finish registration: `registrationRecord`, `identityPublic`, `wrappedIdentity`, `proof`. Answers `userId`. |
| `POST /account/login` | Start login: `username`, `startLoginRequest`. Answers `id`, `loginResponse`, `expiresAt`. |
| `PUT /account/login/:id` | Finish login: `finishLoginRequest`, `binder`. Answers `loginId`, `userId`, `expiresAt`, `identityPublic`, `wrappedIdentity`. |
| `POST /account/session` | Authenticate the channel: `certificate`, `signature`. Used after login and to resume. Answers `certificateId`, `expiresAt`. |


The lifecycle routes are in [Account lifecycle](#lifecycle). The TypeScript client for all of them
is `createSecureClient` in `resource-server/client`.

## Registration
<!--raw-typst <registration> -->


All steps run inside a channel ([Transport](#transport)).

1. The client sends the username, lowercased, and an OPAQUE registration
  request. The server chooses the new user's id and answers with it, the
  registration response, and a pending registration id that expires in 10
  minutes. The client needs the user id now, because the wrap and the proof
  are bound to it.
1. The client completes OPAQUE, getting the registration record and the export
  key. It generates the identity key, derives the wrap key and wraps the
  identity key.
1. The client sends the registration record, the identity public key, the
  wrapped identity key, and a proof of possession: an identity-key signature
  over `"srs-register-v1" ‖ h ‖ user_id ‖ username ‖ identity_public`.
1. The server checks the proof, then in one transaction consumes the pending
  registration, creates the user, and stores the record, the identity public
  key and the wrapped key.

The proof stops a client from registering a public key it does not hold. The
pending registration is consumed once; a second finish fails.

## Login
<!--raw-typst <login> -->


1. The client sends the username and an OPAQUE login request.
1. The server answers with the OPAQUE login response and a pending login id.
  For an unknown username it answers with a response of the same shape, so
  usernames cannot be probed ([Username enumeration](#enumeration)).
1. The client completes OPAQUE, getting `finishLoginRequest`, the OPAQUE
  session key `K` and the export key. It sends `finishLoginRequest` and the
  binder `HMAC-SHA256(K, "srs-bind-v1" ‖ h ‖ sid)`.
1. The server completes OPAQUE, getting its own `K`, and checks the binder in
  constant time. `@serenity-kit/opaque` has no way to bind a context into the
  OPAQUE exchange itself, so the binder is the only channel binding.
  This proves the login ran in this channel: a login relayed from another
  channel has a different `h` and fails. The server then creates a _login
  record_ (id, user, created, expires in 24 hours) and returns the login id and
  the wrapped identity key.
1. The client unwraps the identity key, generates a session key, and sends a
  session certificate ([Session certificates](#certificates)). The channel is now authenticated as the
  user.

Failures return the same `401` and count towards the throttle ([Rate limits](#rate-limits)).

## Session certificates
<!--raw-typst <certificates> -->


```text
cert = "srs-cert-v1" ‖ user_id (16) ‖ login_id (16) ‖ sid (16) ‖ h (32)
       ‖ session_public (32) ‖ issued_at (8) ‖ expires_at (8)
sig  = Ed25519(identity_private, cert)
```

Every field has a fixed length, so the layout is canonical without a general
encoding. Times are milliseconds since the epoch, big-endian.

The server accepts a certificate only if:

- the signature verifies with the user's current identity public key;
- `h` and `sid` are this channel's;
- `login_id` names an unexpired, unended login record of the same user;
- `expires_at` is no later than the login record's expiry;
- the identity key is not revoked ([Revocation](#revocation));
- `issued_at` is within 5 minutes of the server clock, so a certificate cannot
  be backdated to before a revocation;
- the channel is not already logged in.

Every failure is the same `401`. An accepted certificate is stored with its
signature, the id of the identity key that signed it, and the server time it
was accepted. Certificates are never deleted, because retained signatures
([Signed requests](#requests)) need them for later verification.

## Resuming a login
<!--raw-typst <resume> -->


When a channel ends ([Transport](#transport)), the client keeps its identity key and login
id in memory, runs a new handshake, and sends a new session certificate naming
the same login and the new `h`. No password is needed, and the login's expiry
does not move. The identity key is held in memory only, never persisted, so
closing the client ends the ability to resume.

## Username enumeration
<!--raw-typst <enumeration> -->


Login start answers known and unknown usernames with responses of the same
shape and timing. Registration start necessarily reveals that a username is
taken; it is rate-limited like login.

## Rate limits
<!--raw-typst <rate-limits> -->


Handshakes, registration starts and login starts are limited per client
address and per username; five failed logins lock a username for 15 minutes.
Counters are stored in the database, so they survive restarts. Locking by
username lets anyone who knows a username lock that user out temporarily; this
is accepted in exchange for stopping password guessing.

## Storage


| **Row** | **Contents** |
| --- | --- |
| `user` | id, username (fixed at registration), display name |
| `key`, type `opaque_registration`, consumed | the OPAQUE registration record |
| `key`, type `identity` | identity public key, wrapped private key, created, revoked or retired time |
| `key`, type `login` | login record: user, created, expires, ended |
| `key`, type `certificate` | session certificate, its signature, the signing identity key's id, and when it was accepted |
| `key`, pending types | pending registration and login state, consumed once, expiring in 10 minutes |


`key` rows reference `user` with `onDelete: restrict`.
