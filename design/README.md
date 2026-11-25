# astro-ssg design book

This directory is the source-of-truth documentation for `astro-ssg`. It is also
a normal directory that can be served or built by the CLI itself.

```sh
# Read it as a website
astro-ssg serve --template wacss-docs ./design

# Build HTML beside the Markdown chapters
astro-ssg build --template wacss-docs ./design

# Build the PDF edition
./design/build.sh
```

The book's landing page is [`index.md`](./index.md). Its chapter groups are in
[`wacss-docs.json`](./wacss-docs.json), and the PDF chapter order is in
[`index.typ`](./index.typ). Keep those three files aligned when chapters are
added, renamed, or regrouped.

See [`index.md`](./index.md) for the reading order.
