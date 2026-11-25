# Account lifecycle
<!--raw-typst <lifecycle> -->


Status: **Implemented** for the Noise transport (`src/auth/channel-lifecycle.ts`;
key rotation in `src/protocol/server-keys.ts` and `srs rotate-keys`).

All operations here are signed requests in a logged-in channel unless stated
otherwise, and all are audited in `audit_log` with resource `account`.

| **Route** | **Effect** |
| --- | --- |
| `DELETE /account/login/current` | Log out: end this login and its channels. |
| `GET /account/logins` | List active logins: `id`, `createdAt`, `expiresAt`, `current`. |
| `DELETE /account/logins/:id` | End one login. |
| `DELETE /account/logins?others=true` | End every login but this one. |
| `POST /account/password`, `PUT /account/password/:id` | Change the password (two OPAQUE steps). |
| `POST /account/identity/revoke` | Revoke one's own identity key. |
| `POST /account/rekey`, `PUT /account/rekey/:id` | After revocation: new password and new identity key. Allowed only right after a login that found no usable identity key. |
| `POST /account/resets` | Admin: issue a reset token for `userId`. |
| `POST /account/reset`, `PUT /account/reset/:id` | Redeem a reset token (no login needed): new password and new identity key. |
| `POST /account/users/:id/disable`, `…/enable`, `…/revoke` | Admin: disable or enable a user, or revoke their identity key. |


## Logout


The client sends `DELETE /account/login/current`. The server marks the login
record ended and drops every channel using it. The client discards its session
key, identity key and login id. A certificate naming an ended login is refused,
so a device whose login was ended cannot resume.

## Devices


`GET /account/logins` lists the user's unended logins. `DELETE
/account/logins/:id` ends one, dropping its channels. Ending every other login
is `DELETE /account/logins?others=true`.

## Password change


1. The client runs OPAQUE registration again inside the channel, getting a new
  registration record and export key.
1. It wraps the *same* identity key under the new wrap key.
1. It sends the new record and the new wrapped key, signed.
1. The server replaces both in one transaction and, unless the client asks
  otherwise, ends every other login.

The identity key does not change, so every earlier signature stays valid.

## Revocation
<!--raw-typst <revocation> -->


A user who believes their identity key or password is compromised revokes the
identity key. Revocation is signed by the current session, or done by an admin.

- The identity key row gets a `revoked_at` time.
- Every login certified by that key ends; new certificates for it are refused.
- Signatures made before `revoked_at` remain verifiable and are reported as
  *made before revocation*. Signatures after it are refused.
- The user then logs in with OPAQUE, which still works because the password
  is unchanged. The login answers `rekeyRequired: true` and no identity key,
  and the channel stays unauthenticated: the only thing it may do is re-key. The
  client runs a new OPAQUE registration with a new password, generates a new
  identity key, wraps it under the new export key, and registers it with a proof
  of possession (`/account/rekey`). It then certifies a session with the new
  key as usual.

If an attacker also knows the password, they can race the user to this step.
An admin reset ([Forgotten password](#recovery)) settles the race.

## Forgotten password
<!--raw-typst <recovery> -->


OPAQUE cannot recover a password, and without the password the identity key
cannot be unlocked. Recovery therefore creates a new identity key:

1. An admin issues a reset token for the user: 32 random bytes, single use,
  valid for one hour, stored only as a hash. The admin hands it to the user
  out of band.
1. The user, in a channel, sends the token with a new OPAQUE registration, a new
  wrapped identity key and its proof of possession.
1. The server consumes the token, replaces the OPAQUE record, marks the old
  identity key *retired* (not revoked) and registers the new one. All logins
  end.

Signatures made with the retired key stay valid. An admin who issues a reset
can sign in as the user afterwards; this cannot be prevented while recovery
exists. It is mitigated by recording every reset in the audit log and showing
it to the user at their next login (the login answer carries `lastReset`),
and verifiers treat signatures made after an admin reset as accountable to the
reset as well as to the user.

Deployments that need stronger guarantees can disable admin resets with
`SRS_ALLOW_RESET=false`; a forgotten password then means a new account.

## Server key rotation
<!--raw-typst <server-key-rotation> -->


1. The operator runs `srs rotate-keys [--days 30]`, which creates a new key
  bundle and a *transition statement* signed by the old signing key:

  ```text
  "srs-rotate-v1" ‖ old*fingerprint*digest (32) ‖ new_x25519 (32)
  ‖ new*ed25519 (32) ‖ stop*at (8, milliseconds, big-endian)
  ```

  It prints three settings: the new `SRS_SERVER_KEYS`, the old bundle as
  `SRS_PREVIOUS_SERVER_KEYS`, and `SRS_KEY_TRANSITION` (the stop time and the
  signature). The server checks the statement at startup and refuses to start
  with one that does not verify.
1. Until the stop date, `GET /noise/keys` returns the new bundle with the old
  one as `previous` and the statement as `transition`, and the handshake
  accepts either key.
1. A client pinned to the old fingerprint verifies the statement with the old
  signing key, uses the new keys, and reports the new fingerprint through
  `onServerKeyChange` so it can be stored.
1. After the stop date, the server answers handshakes only with the new key and
  no longer offers the statement; the operator removes the two extra settings.

If a server key is stolen, a transition statement cannot be trusted, because
the thief can sign one. Clients must then be given the new fingerprint out of
band.

## Accounts are not deleted


Users that own keys cannot be deleted ([Schema](#schema)), so that retained signatures
stay attributable. An admin can *disable* a user: every login ends and logins
are refused with the same `401` as a wrong password. Enabling the user again
restores logins. Personal data columns can be cleared; the user id, identity key
history and certificates remain.
