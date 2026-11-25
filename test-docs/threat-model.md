# Threat model
<!--raw-typst <threat-model> -->


Status: **Implemented**: the Noise transport is built to it, and the attack
tests check each property ([Status and verification](#status)).

## Deployment assumed


SRS runs on a network the operator does not fully trust, possibly without TLS.
Clients are configured with the server's key fingerprint ([Server keys](#server-keys)) before
first contact.

## Trust, in short


Security without TLS rests on three things the client must get right. Each
replaces part of what TLS does.

1. **The pinned fingerprint.** The client is given the server's fingerprint
  (`srs1:…`, printed by `init`) by a trusted path before it first connects:
  built into an app, typed from the operator's screen, read from a QR code. The
  Noise handshake then proves, from the very first message, registration
  included, that the other end holds that key. Nothing is trusted on first
  use. A client that takes the fingerprint from the network instead (the
  console's *Trust key from server*) is trusting on first use, and an active
  attacker present at that moment can be the server for it.
1. **The client code.** The guarantees hold only while genuine client code runs
  the protocol. Code fetched over the untrusted network can be replaced by an
  attacker, who then reads the password as it is typed, so client code must
  arrive by a trusted path ([Outside the model](#outside-the-model)). This is the gap TLS closes
  for web pages.
1. **The device.** Malware on the client's device sees what the user sees.

Given those, every later message is encrypted to the pinned server, every
request after login is signed by the user's key, and a server key can change
only by a transition signed by the old key ([Server key rotation](#server-key-rotation)). The
channel and the signatures are what is proved, not who a person is: anyone
who can reach the server may register an account. Which accounts may do what
is access control ([Access control](#access-control)).

## Attackers


| **Attacker** | **Can** |
| --- | --- |
| Passive network | Read every packet between client and server. |
| Active network | Read, drop, delay, reorder, replay, alter and inject packets; impersonate either end at the network layer. |
| Malicious client | Send any bytes to any route; hold a valid account. |
| Database thief | Read a copy of the database, including backups. |
| Server key thief | Hold the server's private keys. |
| Dishonest operator | Run modified server code and write to the database, then claim a user signed something. |


## Properties required


| **Property** | **Holds against** |
| --- | --- |
| Passwords are never learnt and cannot be guessed offline | All of the above. The database thief needs the server's OPAQUE key and still only gets online guesses. |
| Requests and responses are confidential | Passive and active network. |
| Requests and responses cannot be altered, replayed, reordered undetected, or moved between sessions | Active network. |
| The client is talking to the real server | Active network, as long as the pinned key is genuine. |
| A request comes from the user it claims | Active network, malicious clients, database thief. |
| A retained signature proves the user's key signed it | Dishonest operator, for signatures made before any admin reset of that user ([Forgotten password](#recovery)). |
| Past traffic stays secret after key theft | Server key thief: forward secrecy through ephemeral keys. |
| Login rate limits cannot be bypassed by forging an address | Malicious client. |


## Outside the model
<!--raw-typst <outside-the-model> -->


- **Client code delivered over the untrusted network.** If a browser loads the
  application's JavaScript over plain HTTP, an active attacker can replace it
  and read the password as it is typed. No transport protects code that the
  attacker writes. Under `noise`, client code must arrive by a trusted path: a
  Bun or Node program, a CLI, a desktop app, a browser extension, or a web app
  loaded from a trusted origin. Browsers on plain-HTTP pages also lack
  `crypto.subtle`, so the client uses pure-JS primitives
  (`@noble/curves`, `@noble/ciphers`, `@noble/hashes`) and
  `crypto.getRandomValues`.
- **A compromised client device.** Malware on the device can use an unlocked
  session.
- **Traffic analysis.** Sizes and timing of requests are visible.
- **Denial of service.** An active attacker can always drop traffic.
- **Registration before the key is pinned.** Pinning is the trust anchor; a
  client given a wrong fingerprint talks to whoever holds that key.
- **A quantum computer.** X25519, Ed25519 and OPAQUE are classical. Someone who
  records traffic today could decrypt it once a large quantum computer exists,
  and such a computer could forge signatures. Hybrid post-quantum algorithms
  are planned for v2.0 ([Roadmap](#roadmap)).
