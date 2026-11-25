# HTTP API
<!--raw-typst <http-api> -->


Status: **Implemented** for both transports.

## Decision


SRS serves JSON:API 1.0 over Hono. Routes are generated from the exposed
resources in the built schema; there are no per-resource controllers.

## Resource routes


```text
GET, HEAD   /                          resource catalog
GET, HEAD   /:type                     collection
POST        /:type                     create
GET, HEAD   /:type/:id                 one resource
PUT, PATCH  /:type/:id                 replace or update
DELETE      /:type/:id                 delete
GET, PATCH, POST, DELETE
            /:type/:id/relationships/:rel
GET, HEAD   /:type/:id/:rel            related resources
```

- Reads come from generated views; writes go to base tables.
- Collections support pagination, sorting, filtering, sparse fieldsets and
  `include`, with read access applied at every step.
- Unknown or unreadable resources return `404`, invalid input `400`,
  constraint violations `409`.

## Transports


The same routes are reached in one of two ways, chosen with `SRS_TRANSPORT`.

|  | *`noise`* | *`bearer`* |
| --- | --- | --- |
| Network | Any, including without TLS | TLS required |
| Wire format | Every request is `POST /noise` with an encrypted envelope | Ordinary HTTP with `Authorization: Bearer` |
| Signing | Every request after login | Per resource, with `x-srs-*` headers |
| Status | Implemented | Implemented |


The HTTP end-to-end tests drive the server over HTTP only, so they serve as
the conformance suite for any implementation ([Implementation plan](#implementation)).

`noise` is the default for the `serve` command, and for `createApp` whenever a key
bundle is given. `SRS_TRANSPORT=bearer` selects the bearer transport. In `noise` mode the server answers
only these routes in the clear: `/healthz`, `/readyz`, `/noise/keys`,
`/noise/handshake` and `/noise`. Every other request is refused, so nothing can
be downgraded to an unencrypted route.

## Account routes


In the bearer transport, registration and login use a small plain-JSON
surface under `/key` ([Authentication routes](#ref-auth)). In the Noise transport they use the routes
under `/account`, which exist only inside a channel ([Accounts and login](#accounts)).

## Request limits


Bodies over the configured limit return `413`. Requests over the per-client
rate limit return `429` with `Retry-After`. Responses carry standard security
headers. CORS headers are sent only for configured origins.
