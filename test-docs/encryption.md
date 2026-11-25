# Encrypted fields
<!--raw-typst <encrypted-fields> -->


Status: **Specified**. Built after v1.0 (roadmap v1.4). Nothing here changes the
v1 wire format: it adds new labels beside it (D056).

## Decision


A schema can mark a string property `x-encrypted: true`. The client encrypts
that property before it sends a row and decrypts it after it reads one, so the
database, the server and anyone who copies either only ever hold ciphertext.
Transport encryption (Noise or TLS) protects data while it travels; this
protects it where it is kept. It works the same over either transport.

The server cannot read, filter, sort or validate an encrypted value beyond
its envelope. Everything else about the row (its id, owner, visibility,
relations and other attributes) stays in the clear, so access control,
sharing and relations work as they do today.

## Keys


| **Key** | **Held** | **Purpose** |
| --- | --- | --- |
| Encryption key pair | one X25519 pair per user. The public half is stored in the clear; the private half is stored wrapped | Receives row keys. Created with the account, or at first use. |
| Wrap key | derived on the client, never stored | `HKDF-SHA256(export_key, info = "srs-encryption-wrap-v1")` from the OPAQUE export key ([Accounts and login](#accounts)). Wraps the private half. |
| Row key | one random 32-byte key per row that has encrypted fields; stored only wrapped | Encrypts that row's fields. |


- The private encryption key is wrapped like the identity key: XChaCha20-Poly1305
  under the wrap key, with associated data `"srs-encryption-key-v1" ‖ user id
  ‖ public key`.
- A row key is **sealed** to each reader's public key: an ephemeral X25519 key
  pair, `HKDF-SHA256(shared secret, info = "srs-row-key-v1" ‖ ephemeral public
  ‖ recipient public)` as the key, XChaCha20-Poly1305 with associated data
  `table ‖ row id ‖ recipient user id`. The owner's own copy is sealed to the
  owner the same way, so there is one rule for everyone.
- Sealed row keys live in a derived table `<table>_row_key` (row, user, sealed
  key), created for every table with an encrypted property, readable only by
  the user each copy is sealed to.

## Fields


- A field key is `HKDF-SHA256(row key, info = "srs-field-v1" ‖ table ‖ column)`.
- The stored value is `srs-enc-v1:` followed by base64url of a 24-byte nonce
  and the XChaCha20-Poly1305 ciphertext, with associated data `table ‖ column ‖
  row id`. Binding the row id and column means a ciphertext moved to another
  row or column fails to decrypt.
- Rows with encrypted fields are keyed by a client-made uuid (`data.id` on
  create), so the client knows the row id before it encrypts.
- The server checks only that the value has the envelope's form. The schema's
  other keywords (`maxLength`, `pattern`, `enum`) are refused on an encrypted
  property, because the server cannot check them; filtering or sorting on one
  is a `400`.

## Sharing and its limits


- Sharing a row ([Access control](#access-control)) also seals its row key to the new reader:
  the sharer's client reads the reader's public key and writes the sealed copy.
  A share without its key gives access to the clear columns only.
- Removing a share deletes the reader's copy, but they may have kept the row
  key. To lock them out of later changes, the owner's client re-encrypts the
  row under a new row key.
- Groups: a share with a group seals the key to each member at that moment.
  Members who join later need someone holding the key to seal it to them.
  **Open.**

## Password change, reset and recovery


- A password change rewraps the private encryption key under the new wrap key;
  no data is re-encrypted.
- An admin password reset ([Forgotten password](#recovery)) gives a new export key, so the old wrap
  key is gone: the user's encrypted fields become unreadable to them, unless
  they kept a recovery code. Shared rows stay readable by the others they are
  shared with.
- Recovery codes: the client can make one random code, shown once, that also
  wraps the private encryption key. **Open:** whether to offer it by default.

## What this does not protect


- Which rows exist, who owns them, who they are shared with, their sizes and
  when they change: all of that is metadata the server needs.
- A dishonest server can withhold, delete or replay old ciphertext. Signed
  writes ([Signed requests](#requests)) and the audit log make that detectable, not impossible.
- A compromised client device, or client code delivered over an untrusted
  network ([Threat model](#threat-model)), sees the plaintext.
