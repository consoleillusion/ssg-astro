// astro-ssg design book. Build the PDF with ./build.sh.
// This file holds the PDF layout and chapter order. The chapters themselves
// are the Markdown files in this directory. The website order is mirrored in
// wacss-docs.json; keep the two lists in sync.

#import "@preview/cmarker:0.1.10"

// Markdown chapters use `#` for a chapter heading. Mapping h1 to Typst level 2
// leaves level 1 for part pages. No generated slugs are needed.
#let md(path) = cmarker.render(
  read(path),
  h1-level: 2,
  heading-labels: none,
  set-document-title: false,
  raw-typst: true,
)

// ── Palette and typography ───────────────────────────────────────────────
#let bone = rgb("#fafafa")
#let ink = rgb(27, 24, 21).transparentize(8%)
#let muted = rgb(27, 24, 21).transparentize(48%)
#let rule = rgb(27, 24, 21).transparentize(82%)
#let shade = rgb("#e8e4db")
#let accent = rgb("#7a2e1d").transparentize(8%)
#let navy = rgb("#16232e")

#let sans = ("Inter", "Fira Sans", "Noto Sans", "DejaVu Sans", "Liberation Sans")

#set document(title: "astro-ssg design book", author: "astro-ssg")
#set page(
  paper: "a4",
  fill: bone,
  margin: 2.5cm,
  header: context {
    let page-no = here().page()
    let starts = query(heading.where(level: 1).or(heading.where(level: 2)))
      .filter(h => h.location().page() == page-no)
    let chapters = query(heading.where(level: 2).before(here()))
    if starts.len() == 0 and chapters.len() > 0 {
      set text(size: 8pt, fill: muted)
      align(right, chapters.last().body)
    }
  },
  footer: context {
    set text(size: 8pt, fill: muted)
    align(center, counter(page).display())
  },
)

#set text(font: sans, size: 10.5pt, fill: ink, lang: "en", hyphenate: false)
#set par(justify: false, leading: 0.72em, spacing: 1.25em)
#set list(indent: 0.4em, body-indent: 0.6em, spacing: 0.85em, marker: text(fill: muted)[•])
#set enum(indent: 0.4em, body-indent: 0.6em, spacing: 0.85em)
#show strong: set text(weight: 600)
#show link: set text(fill: accent)

// ── Code and tables ──────────────────────────────────────────────────────
#show raw: set text(size: 8.8pt)
#show raw.where(block: true): it => block(
  fill: shade,
  inset: (x: 12pt, y: 10pt),
  radius: 4pt,
  width: 100%,
  above: 1.4em,
  below: 1.4em,
  it,
)
#show raw.where(block: false): it => box(
  fill: shade,
  inset: (x: 2.5pt),
  outset: (y: 2.5pt),
  radius: 2pt,
  it,
)

#set table(
  inset: (x: 7pt, y: 7pt),
  stroke: (_, y) => if y == 0 { (bottom: 0.8pt + muted) } else { (bottom: 0.4pt + rule) },
  fill: (_, y) => if y == 0 { shade },
)
#show table: set text(size: 9.6pt)
#show table: set par(leading: 0.62em)
#show table: it => block(above: 1.4em, below: 1.6em, it)

// ── Headings ─────────────────────────────────────────────────────────────
#set heading(numbering: none)

#let title-group(above, title, below, size: 34pt) = {
  set text(top-edge: "cap-height", bottom-edge: "baseline")
  set par(spacing: 0pt)
  stack(
    spacing: 14pt,
    text(size: 12pt, weight: 600, above),
    text(size: size, weight: 300, title),
    if below != none { block(width: 78%, text(size: 12pt, fill: muted, below)) },
  )
}

#show heading.where(level: 1): it => block(text(weight: 300, it.body))

#show heading.where(level: 2): it => {
  pagebreak(weak: true)
  v(0.4cm)
  block(below: 1.6em, text(size: 24pt, weight: 500, it.body))
}

#show heading.where(level: 3): it => block(
  above: 2.4em,
  below: 1em,
  sticky: true,
  text(size: 13.5pt, weight: 600, it.body),
)

#show heading.where(level: 4): it => block(
  above: 1.6em,
  below: 0.7em,
  sticky: true,
  text(size: 11pt, weight: 600, it.body),
)

// References to unnumbered headings show the heading title as a link.
#show ref: it => {
  let target = it.element
  if target != none and target.func() == heading {
    link(target.location(), target.body)
  } else {
    it
  }
}

// ── Parts ────────────────────────────────────────────────────────────────
#let part(numeral, title, summary) = page(header: none, footer: none)[
  #v(1fr)
  #title-group([Part #numeral], heading(level: 1, supplement: [Part #numeral], title), summary)
  #v(1.4fr)
]

// ── Contents ─────────────────────────────────────────────────────────────
#show outline: it => {
  show link: set text(fill: ink)
  it
}
#show outline.entry.where(level: 1): it => {
  v(1.3em, weak: true)
  link(it.element.location(), text(weight: 600)[
    #it.element.supplement #h(0.6em) #it.element.body #h(1fr) #it.page()
  ])
}
#show outline.entry.where(level: 2): it => {
  v(0.55em, weak: true)
  it
}

// ── Title page ───────────────────────────────────────────────────────────
#page(header: none, footer: none, fill: navy)[
  #set text(fill: bone)
  #place(bottom + left, {
    set par(spacing: 0pt)
    stack(
      spacing: 16pt,
      text(size: 12pt, weight: 600)[astro-ssg],
      text(size: 44pt, weight: 300)[Design book],
      text(size: 12pt, fill: rgb("#a6a6a6"))[From ordinary files to a rendered site],
    )
  })
]

#page(header: none)[
  #v(0.4cm)
  #text(size: 24pt, weight: 500)[Contents]
  #v(1.2em)
  #outline(title: none, depth: 2, indent: 1.4em)
]

// ── Book ─────────────────────────────────────────────────────────────────
#part("I", "Foundations",
  [What the library is, the problem it solves, and where every responsibility lives.])
#md("purpose.md")
#md("source-map.md")

#part("II", "Operating the CLI",
  [Commands, flags, validation, cache initialization, dependency installation, and Astro process handling.])
#md("cli.md")
#md("cache-and-runtime.md")

#part("III", "Content and rendering",
  [How pages are discovered, rendered, styled, and given optional navigation.])
#md("routing.md")
#md("markdown-pipeline.md")
#md("styling.md")
#md("menu.md")

#part("IV", "Advanced modes",
  [In-browser editing, Typst compilation, and publishing static HTML beside sources.])
#md("edit-mode.md")
#md("typst.md")
#md("build-output.md")

#part("V", "wacss-docs",
  [The render-time documentation template, its configuration, layout, and bundled components.])
#md("wacss-docs-config.md")
#md("wacss-docs-layout.md")
#md("wacss-components.md")

#part("VI", "Reference",
  [Complete flag, environment, and configuration tables, plus invariants and sharp edges.])
#md("configuration.md")
#md("invariants.md")
