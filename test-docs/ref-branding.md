# Branding
<!--raw-typst <ref-branding> -->


Status: **Implemented** on the title page of this book.

## The logotype


<!--raw-typst #block(fill: night, inset: (x: 28pt, y: 24pt), radius: 3pt, width: 100%)[ #logo(size: 72pt) ] -->

<!--raw-typst #block(fill: white, inset: (x: 28pt, y: 24pt), radius: 3pt, width: 100%, stroke: 0.5pt + luma(220))[ #logo(size: 72pt, dark: false) ] -->


When srs is shown as a brand, on a title page, a logo, an icon or a banner, it
is set:

- in **lowercase**: `srs`, never `SRS` or `Srs`;
- in a **sans serif**, at its **heaviest weight** (black, 900);
- in **italic**;
- in one **gray**, all three letters.

The typeface is Inter Display Black Italic, with Inter, DM Sans and Fira Sans as
fallbacks (`design/index.typ`).

## What each choice says


- **Thickness** is stability and robustness.
- **Italics** are speed and performance.
- **Sans serif** is modern, unobtrusive and unadorned.
- **Lowercase** is simplicity and ease of use.
- **Gray** is a background colour that goes with anything, as srs serves stably
  and reliably in the background.

## Colours


| **Use** | **Colour** | **Notes** |
| --- | --- | --- |
| Dark background | `#111111` | The title page. |
| Logotype on dark | `#a6a6a6` | 7.7:1 on `#111111`: WCAG AAA at any size. |
| Small text on dark | `#a6a6a6` | The quiet line below the logotype. |
| Other text on dark | `#ece6d8` | Warm off-white, for the name above the logotype. |
| Logotype on light | `#767676` | 4.5:1 on white: AA at any size. `#a6a6a6` is too faint on a light background (2.4:1). |


## The title page


The logotype stands alone in the lower left, between two small lines: the
name, *Standard Resource Server*, above, and what the document is below (here,
*Design: goals, rules, protocol and roadmap*). The word "design", or any other
document name, never sits beside the logotype as part of it.

## In running text


These rules are for branding only. In writing, including this book, code
comments, the README and messages, the project is written plainly in the
surrounding text's own style: SRS, or Standard Resource Server. Setting it in
heavy gray italics inside a sentence would be distracting and unlike any
other name.
