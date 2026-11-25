# Introduction
<!--raw-typst <introduction> -->


Status: **Implemented** — this book is maintained.

SRS (Standard Resource Server) turns a folder of JSON Schema files into a
backend: database tables, relations, views, migrations, a JSON:API, user
accounts and per-row access control. Application authors write schema, not
CRUD handlers. It is meant to be run by anyone with one command, including on
internal networks without TLS.

## This book is the source of truth


This book decides what SRS is, how it must behave, how it is built and what
is done next. It is written for maintainers, contributors and AI agents alike,
and must be complete enough that any of them can pick up the next task without
other context.

- Where code and this book disagree, the book describes the intended
  behaviour. The difference is a defect to be listed under known gaps
  ([Status and verification](#status)) and fixed, unless the book is changed first through the decision
  log ([Decision log](#decisions)).
- Documentation flows one way. This book decides behaviour and holds the
  reference (Part VI). Code documents itself with TSDoc comments, and TypeDoc
  generates the API reference into `doc/` from them; nothing in `doc/` is
  written by hand.
- The roadmap ([Roadmap](#roadmap)) is the only list of planned work. Work not on it is
  added to it before it starts.
- How to work on SRS, including conventions and the checks every change must
  pass, is in [Working on SRS](#contributing).

## Status markers


Every chapter starts with a status line:

- **Implemented** — the code follows this chapter.
- **Specified** — the design is settled and the code does not follow it yet.
- **Open** — the design is not settled; do not build it.

## Conventions


*Must*, *must not*, *should* and *may* have their usual specification
meanings. Identifiers, settings and wire values are in `monospace`. Byte
strings are joined with `‖`. Lengths in byte layouts are in bytes.

## How the book is organised


- **Part I, Project** — the problem SRS solves and its uses ([Why SRS](#why)), then goals,
  stack and architecture.
- **Part II, Data and API** — schema, migrations, views, importing existing
  databases, access control and the HTTP API.
- **Part III, Security** — the threat model and the protocol: transport, accounts,
  signed requests and the account lifecycle.
- **Part IV, Delivery** — operations, the implementation plan and the roadmap.
- **Part V, Working on SRS** — contributor rules, repository layout, the
  decision log and current status.
- **Part VI, Reference** — the schema keywords, data model, API, authentication
  routes, deployment settings, development commands and the browser console.

Anyone deciding whether to use SRS should read [Why SRS](#why). A newcomer to the code
should read Parts I and V first, then the chapters their task cites.
