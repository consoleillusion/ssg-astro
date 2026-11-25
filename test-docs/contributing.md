# Working on SRS
<!--raw-typst <contributing> -->


Status: **Implemented** — these rules apply to every change, by people and by
agents.

## Before starting


1. Read [Introduction](#introduction), [Goals](#goals) and [Stack](#stack), then this chapter.
1. Pick the first task in [Roadmap](#roadmap) whose state is **Next**. Work on one task at a
  time.
1. Read every chapter the task cites, and [Status and verification](#status) for known gaps that touch it.
1. If the book does not settle a question the task needs answered, do not
  guess. Add it to the open questions in [Status and verification](#status) and ask the maintainer.

## Definition of done


A change is done when all of these hold:

- the task's *done when* condition in [Roadmap](#roadmap) holds;
- new behaviour has tests, and every security rule it touches has a test that
  tries to break it;
- these commands pass:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test        # generates migrations, then runs every test
bun run audit
bun run docs:check  # every export documented
bun run design      # the book compiles
```

- every command shown in the book or the README has been run as written, in
  a fresh checkout, and its output matches what the text says;
- the book is updated: the task set to **Done**, chapter status lines corrected,
  new gaps listed in [Status and verification](#status);
- the reference chapters (Part VI) and TSDoc comments describe any changed
  user-visible behaviour;
- the commit message names the task, for example `v0.3.2: Noise NK handshake`;
- `package.json` carries the task's version and the commit is tagged with it
  ([Roadmap](#roadmap)).

## Changing the design


- A rule in this book changes only with a new row in [Decision log](#decisions), added in the
  same change. A replaced row is marked **Superseded** with the id of its
  replacement; rows are never deleted.
- A frozen protocol version ([Implementation plan](#implementation)) is never edited. A change to the
  wire format introduces a new version string and its own fixtures.
- A change that touches Part III must say, in the commit message, which
  properties in [Threat model](#threat-model) it affects, and add attack tests for them.
- Security must not be weakened to adopt a standard or a library ([Goals](#goals)).

## Security rules for code


- Never implement a cryptographic primitive. Use the libraries in [Stack](#stack).
- Compare MACs, tokens and hashes in constant time.
- Never log secrets, tokens, request bodies, or query strings.
- Never build SQL from user input. Identifiers come from the built schema and
  are quoted with `quote()`; values are always bound parameters.
- Every failure of an authentication or protocol check returns the same
  response, so the reason is not revealed.
- Hidden rows return `404`, never `403`.

## Code conventions


The existing code sets the style; match it.

- TypeScript, strict; no semicolons; single quotes; two-space indent.
- Functions are `const` arrow functions. Multi-line objects, arrays and
  argument lists use leading commas.
- Documentation flows one way: this book decides behaviour, code documents
  itself with TSDoc comments, and TypeDoc generates the reference in `doc/`
  from them. Nothing in `doc/` is written by hand.
- Every exported function, type and constant has a TSDoc comment (summary,
  `@param`, `@returns`, `@throws` where relevant, `@example` for public API);
  `docs:check` fails otherwise. Internal functions get a TSDoc summary when
  their purpose is not obvious from the name.
- A TSDoc comment says what the code does and cites the book chapter for why,
  rather than restating design rules.
- Imports use explicit `.ts` extensions.
- Errors returned to clients are created with the `ApiError` factories in
  `src/server/errors.ts`.
- Settings are environment variables named `SRS_*`, read in one place, validated
  at startup, and listed in `.env.example` and [Deployment](#ref-deployment).
- File names are kebab-case.

## Tests


- `spec/` holds end-to-end tests that drive the app through
  `app.request(...)` with a migrated in-memory database (`spec/helpers/`).
- `spec/unit/` holds unit tests, organised by module.
- Protocol behaviour also gets conformance fixtures: frozen JSON cases in
  `conformance/`, checked by hand before they are committed and changed only
  when the behaviour they pin changes ([Implementation plan](#implementation)).
- Tests must not depend on network access or on the order they run in.

## The book


- One chapter per Markdown file in `design/`, rendered from `index.typ` under
  its part. A new chapter gets a `.md` file, a stable label comment after its
  heading (`<!--raw-typst <name> -->`), a `md(...)` line in `index.typ`, and a
  row in [Repository layout](#layout).
- Refer to chapters and sections by stable label (`#transport`), never by
  number. In Markdown write `[Transport](#transport)`; the link works in both
  the site and the PDF.
- Every chapter starts with a status line ([Introduction](#introduction)).
- Describe the design as it is; do not narrate how it came to be.
- Build with `bun run design`; the PDF is not committed. `static_site/` is
  generated output, not a second source.
