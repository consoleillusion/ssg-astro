# astro-ssg design book

`astro-ssg` turns an ordinary directory of Markdown, MDX, Typst, HTML, and
Astro files into a website without asking that directory to become an Astro
project. This book describes the library from first principles: the problem it
solves, the CLI, the cached template, routing, rendering, styling, editing,
Typst, static output, and the `wacss-docs` documentation template.

It is both the specification and a worked example. The files in this directory
are the chapters; [`wacss-docs.json`](./wacss-docs.json) groups them into parts;
[`index.typ`](./index.typ) assembles the same chapters into a PDF.

## How to read

- **[Part I — Foundations](/purpose)** explains the mental model and maps every
  source file to its responsibility.
- **[Part II — Operating the CLI](/cli)** covers commands, flags, cache
  lifecycle, and how Astro is launched.
- **[Part III — Content and rendering](/routing)** covers route discovery,
  Markdown processing, styling, and the standalone menu.
- **[Part IV — Advanced modes](/edit-mode)** covers in-browser editing, Typst,
  and static build output.
- **[Part V — wacss-docs](/wacss-docs-config)** specifies the documentation
  template and the bundled WACSS components.
- **[Part VI — Reference](/configuration)** collects every flag, environment
  variable, config field, invariant, and known sharp edge.

## Source of truth

The code is final. When a sentence here and the implementation disagree, the
implementation wins and this book should be corrected. The top-level
[`README.md`](../README.md) is the user-facing quick reference; this book is
the implementation-level description.

## Two outputs, one source

The website and the PDF are generated from the same Markdown chapters:

```sh
# Website, with the wacss-docs template applied at render time
astro-ssg serve --template wacss-docs ./design

# PDF, using cmarker inside Typst
./design/build.sh
```

Neither command rewrites the chapter files. `serve` leaves them untouched;
`build` writes generated `.html` files beside them, and those files are marked
so they never outrank their sources.
