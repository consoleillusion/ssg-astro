# Transport
<!--raw-typst <transport> -->


Status: **Implemented** (`src/protocol/noise.ts`, `src/protocol/envelope.ts`,
`src/server/noise-handshake.ts`, `src/server/noise-route.ts`,
`src/client/channel.ts`).

## Decision


Under `SRS_TRANSPORT=noise`, all traffic after the handshake runs through a
Noise channel that authenticates the server by a pinned key, encrypts every
request and response, and carries forward secrecy. TLS is not required.

## Primitives


- Handshake: `Noise_NK_25519_ChaChaPoly_BLAKE2s`.
- Prologue: the ASCII string `srs-noise-v1` followed by the 32-byte server key
  fingerprint.
- Signatures ([Signed requests](#requests)): Ed25519.
- Hashes outside Noise: SHA-256. Key derivation: HKDF-SHA256.

NK is the pattern for a client that knows the server's static key in advance
and has none of its own. The client's identity is established inside the
channel by OPAQUE ([Accounts and login](#accounts)), not by Noise.

## Server keys
<!--raw-typst <server-keys> -->


The `init` command creates a server key bundle and prints its fingerprint:

- an X25519 static key for Noise;
- an Ed25519 signing key, used to sign key rotations ([Server key rotation](#server-key-rotation))
  and, optionally, responses.

The fingerprint is SHA-256 of `srs-keys-v1 ‖ x25519_public ‖ ed25519_public`,
written as `srs1:` followed by base32. Clients are configured with it:
`createSecureClient({ baseUrl, serverKey: "srs1:…" })`. `GET /noise/keys` returns the
public bundle in the clear as JSON (`version`, `x25519`, `ed25519` in
base64url, and `fingerprint`); the client accepts it only if it hashes to the pinned
fingerprint. The bundle is held in the `SRS_SERVER_KEYS` setting as `srs-keys-v1:`
followed by the base64url of its 64 secret bytes (the X25519 private key, then
the Ed25519 seed), outside the database like `OPAQUE_SERVER_SETUP`, and backed up
separately.

## Handshake


```text
client                                        server
POST /noise/handshake   msg1: e, es  ───────►
                        ◄───────  msg2: e, ee ‖ payload { sid }
```

- Both messages are sent as raw bytes with content type
  `application/vnd.srs.noise`. Message 1 carries an empty payload, so it is
  exactly 48 bytes; message 2 carries the 16-byte `sid` and is 64 bytes.
- `sid` is 16 random bytes naming the channel. It is not a secret.
- After `msg2`, both sides hold two transport keys, `k_c2s` and `k_s2c`, and
  the handshake hash `h`. `h` identifies this channel and is bound into login
  ([Login](#login)) and into every signature ([Signed requests](#requests)).
- A failed handshake returns `400` with no detail.
- Handshakes are limited to 60 per client address per minute; more get `429`.
- Channels that are not authenticated by a login within 10 minutes are
  dropped.

## Envelope


Every later request is `POST /noise` with content type
`application/vnd.srs.noise` and this body:

```text
"SRS1" ‖ sid (16) ‖ n (8, big-endian) ‖ ciphertext
ciphertext = ChaCha20-Poly1305(k_c2s, nonce = n, ad = "SRS1" ‖ sid ‖ n, plaintext)
```

The request plaintext is five length-prefixed fields (each a 4-byte
big-endian length, then the bytes):

```text
method ‖ path_with_query ‖ headers ‖ body ‖ signature
headers = name ‖ value ‖ name ‖ value …   (each length-prefixed, names lowercase)
```

Only `accept`, `content-type` and `x-request-id` are carried; any other header
is dropped, so nothing such as a bearer token can be smuggled in. `signature`
is empty before login and 64 bytes after ([Signed requests](#requests)). Paths are therefore
hidden from the network.

The server decrypts, checks the counter ([Replay and ordering](#replay)), and passes an ordinary
request to the application. The response is:

```text
"SRS1" ‖ sid ‖ n ‖ ChaCha20-Poly1305(k_s2c, nonce = n, ad = "SRS1" ‖ sid ‖ n, response)
```

using the same `n` as the request, so a response cannot be attached to another
request or another channel. The response plaintext is four length-prefixed
fields: the status as three ASCII digits, the headers (`allow`,
`content-type`, `location`, `retry-after`, `x-request-id` only), the body, and
the server's response signature, empty unless responses are signed.

The decrypted request is handed to the same application with its channel
attached out of band, never as a header. It is rate-limited and logged once,
under its own path, with the outer request's client address. A request inside a
channel for a path under `/noise` gets `404`.

Noise permits explicit nonces for transports that deliver out of order; this
is that case. Each key encrypts a given nonce at most once, because a request
counter is accepted at most once and a response reuses only its own request's
counter under the other key.

## Replay and ordering
<!--raw-typst <replay> -->


The server keeps, per channel, the highest counter seen and a 1024-bit window
of the counters below it, as WireGuard does.

- A counter already seen, or below the window, is rejected.
- Counters may arrive out of order within the window, so concurrent requests
  work.
- The client increments its counter for every request, including retries. A
  retry is a new request; whether repeating a write is safe is the
  application's concern.
- A replayed counter is answered `409` in the clear without detail, and the
  client starts a new request. An envelope that is malformed or does not
  authenticate is answered `400`, and its counter is not used up, so a forged
  envelope cannot block a real one.

## Channel lifetime


- A channel ends after 24 hours, after $2^32$ requests, after its login ends,
  or when the server restarts. Channel keys and windows live only in memory.
- The client then runs a new handshake and resumes its login ([Resuming a login](#resume)) without
  asking for the password again.
- An unknown or ended `sid` is answered `401` in the clear. Because this answer
  is not authenticated, an active attacker can forge it; the only effect is an
  extra handshake.

## Strict mode


Under `noise`, the server answers every request that is not one of the clear
routes listed in [HTTP API](#http-api) with `426 Upgrade Required`, whatever it carries,
including a bearer session id. The client refuses to send anything outside the
channel. There is no fallback, so an attacker cannot remove the encryption by
making each side believe the other lacks it.
