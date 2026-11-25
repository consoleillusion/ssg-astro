# Signed requests
<!--raw-typst <requests> -->


Status: **Implemented** for both transports.

## Decision


Under `noise`, every request after login is signed with the session key, then
encrypted. Encryption already proves to the server that a request came through
the channel; the signature adds proof to a third party, because the server
holds the channel keys and could forge a channel message, but cannot forge a
signature.

## Signed message


```text
"srs-req-v1" ‖ h ‖ sid ‖ n ‖ method ‖ path_with_query ‖ content_type ‖ SHA-256(body)
```

Every field is prefixed with its length as a 4-byte big-endian integer; `n`
is 8 bytes big-endian; `content_type` is empty when the request has none. The signature (64 bytes) is placed inside the encrypted envelope
([Transport](#transport)), so it is not visible on the wire. Including `h`, `sid` and `n`
ties each signature to one message in one channel: it cannot be replayed in
another channel or at another position.

The server verifies the signature with the channel's certified session key
before the request reaches the application. A missing or invalid signature
returns `401`.

## Unsigned messages


The handshake, registration, login and resume messages are sent before a
session key is certified, so they are not signed. All of them except the
handshake travel encrypted in the channel, and OPAQUE and the certificate
checks authenticate them.

## Retention
<!--raw-typst <retention> -->


A signature proves nothing later unless it is kept. The server retains, in the
`audit_log` row of the request:

- the signed message fields, the signature and the certificate id, for every
  write and for every operation listed in the resource's `x-access.signed`;
- the request body as well, for those operations, so the signed content can be
  shown later (bodies are bounded by the request size limit).

Reads are verified but not retained unless listed in `x-access.signed`. With
`SRS_RETAIN_READS=true`, every signed read is retained too.

The audit row holds `signature` (base64url), `certificate_id`,
`signed_message` (the exact signed bytes, base64url) and `body`. `audit_log`
is append-only ([Access control](#access-control)).

## Verifying a retained signature


Anyone holding the database can check a retained signature without trusting the
server. `srs verify-signatures` does this for every retained signature, with
the server stopped, and exits non-zero if any fails:

1. Rebuild the signed message from the retained fields and body.
1. Check the signature against the certificate's `session_public`.
1. Check the certificate's signature against the user's identity public key.
1. Check that the identity key belongs to the certificate's user and was not
  revoked before the certificate was accepted ([Revocation](#revocation)).
1. Check that the signed message names the certificate's channel, and that its
  body hash matches the retained body.

## Responses


Responses are encrypted and authenticated by the channel. With
`SRS_SIGN_RESPONSES=true`, the server also signs
`"srs-res-v1" ‖ h ‖ sid ‖ n ‖ status ‖ SHA-256(body)` with its server signing
key, giving the client proof of what the server returned.

## Bearer transport


In the bearer transport, signing is per resource: operations listed in
`x-access.signed` need `x-srs-timestamp`, `x-srs-nonce` and `x-srs-signature`
headers, made with the session key whose public half was sent at login, and
used nonces are stored until they expire. The session id is a bearer token and
travels in clear text except under TLS; this transport therefore requires TLS.
