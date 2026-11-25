# SRS design book

The source of truth for SRS: goals, stack, architecture, the security
protocol, the roadmap, and the rules for working on the project. Each chapter
is a Markdown file; `index.typ` is the single Typst entry point that renders
them to PDF with [cmarker](https://typst.app/universe/package/cmarker) and
holds the brand, layout, styles, part pages and contents.

```bash
./design/build.sh           # writes dist/srs.pdf
./design/build.sh --watch   # rebuilds on save
bun run design              # same as the first line
```

`build.sh` uses the `typst` command if installed, otherwise the `typst` Python
package. The Markdown files are also directly usable by static site
generators such as Astro. The HTML pages in `../static_site/` are generated
output; edit the Markdown, not those pages.

When adding a chapter:

1. Create `design/<name>.md` with one `#` heading.
2. Put `<!--raw-typst <label> -->` on the line after the heading so the label
   works in both the site and the PDF.
3. Add a `#md("<name>.md")` line to `index.typ` under the right part.
4. Add a row for the file in [layout](layout.md) and update `README.md` here.

Refer to chapters and sections by their stable labels, for example
`[Transport](transport.md#transport)`.

| Part | Chapters |
| --- | --- |
| I. Project | `why`, `introduction`, `goals`, `stack`, `architecture` |
| II. Data and API | `schema`, `migrations`, `authored-views`, `existing-databases`, `access-control`, `http-api` |
| III. Security | `threat-model`, `transport`, `accounts`, `requests`, `lifecycle`, `encryption` |
| IV. Delivery | `operations`, `implementation`, `roadmap` |
| V. Working on SRS | `contributing`, `layout`, `decisions`, `status` |
| VI. Reference | `ref-schema`, `ref-data-model`, `ref-api`, `ref-auth`, `ref-deployment`, `ref-development`, `ref-console`, `ref-branding` |

Contributors and agents: start with [AGENTS.md](../AGENTS.md). The generated
API reference is written to `doc/` by `bun run docs`.
