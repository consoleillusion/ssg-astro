# wacss-docs configuration

`wacss-docs` is a render-time template. It applies styling and a complete
documentation layout without rewriting source files. The CLI selects it with:

```sh
astro-ssg serve --template wacss-docs ./design
astro-ssg build --template wacss-docs ./design
```

A bare `--template` also selects `wacss-docs`; `--template none` disables it.

## Config discovery

`src/wacss-docs/config.ts` reads `wacss-docs.json` from the served directory.
`docs.json` is accepted as an alias. If both exist, `wacss-docs.json` wins.
A missing config is silently treated as empty; malformed JSON produces a warning
and is treated as empty.

The config is read on every layout render, so edits need no restart.

## Config fields

```json
{
  "title": "astro-ssg design book",
  "description": "A from-scratch description of the library.",
  "home": "/",
  "palette": "aizome",
  "footer": "Built from Markdown and index.typ",
  "links": [{ "label": "Source", "href": "https://example.com/repo" }],
  "hide": ["README.md"],
  "ungroupedTitle": "More pages",
  "groups": [
    {
      "title": "I. Foundations",
      "description": "What the library is.",
      "pages": ["purpose.md", { "page": "source-map.md", "title": "Source map" }]
    }
  ]
}
```

| Field | Default | Meaning |
| :--- | :------ | :------ |
| `title` | `Documentation` | Site title in the nav bar and title tag. |
| `description` | empty | Site description and meta description. |
| `home` | `/` | Nav bar title link. |
| `palette` | `kinari` | Initial WACSS palette; `matcha`, `aizome`, and `sakura` are also supported. |
| `footer` | empty | Footer text under chapters. |
| `links` | empty | Nav bar links; only entries with string `label` and `href` are kept. |
| `hide` | empty | Page keys excluded from navigation and search. |
| `ungroupedTitle` | `More pages` | Title for discovered pages not named in a group. |
| `groups` | empty | Ordered chapter groups. |

Group pages may be strings or objects with `page`, optional `title`, and
optional `description`.

## How pages are resolved

The config does not create pages. It only labels and orders pages discovered by
`listPages()` from the served directory.

For each page, the loader indexes three keys:

- the URL without leading or trailing slashes
- the path relative to the served directory
- the basename

`keyOf()` strips a leading slash, trailing slashes, and a recognized page
extension, then lowercases. `index` is forced to `/`, which means the root page
can never be a chapter item.

A group entry is resolved by matching its normalized key against that index. If
the target is missing, hidden, or the root page, the entry is discarded. A page
used by an earlier group is skipped in later groups, so chapter order is
exactly the order in the config.

## Labels and descriptions

If a group entry does not provide a title, the loader uses the page's first
`#` heading with markup stripped. If there is no heading, it title-cases the
last key segment.

If no description is provided, `summaryOf()` reads the first prose paragraph:

- leading frontmatter is removed
- headings, fences, comments, tables, blockquotes, and `Status:` lines are
  skipped
- links and emphasis are stripped
- whitespace is collapsed and the text is truncated to 180 characters

The same description appears in home cards and search results.

## Ungrouped pages

After processing configured groups, every discovered non-root page that was not
used and is not hidden is sorted by path and appended under
`ungroupedTitle`. Empty groups are removed.

The `hide` check for grouped entries uses the config key, while the check for
ungrouped leftovers uses the discovered file key. In ordinary use these match,
but a page hidden by URL key rather than file key could reappear as ungrouped.

## Navigation and search metadata

`loadWacssDocsSite()` returns:

- `groups` with resolved `items`
- a flat `items` array in chapter order
- `itemFor(url)` for the current page
- `neighbors(url)` for previous/next links

`WacssDocs.astro` serializes the flat items into a JSON script tag used by the
search dialog. `<` is escaped to `\u003c` so a page title cannot break out of
the script element.

## Keeping the website and PDF aligned

The website chapter order comes from `wacss-docs.json`; the PDF chapter order
comes from `index.typ`. They are independent files. When adding, renaming, or
regrouping chapters, update both. This book also keeps a plain `README.md`
hidden from navigation via `hide`.

Continue with [wacss-docs layout](/wacss-docs-layout).
