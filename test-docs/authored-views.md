# Authored views
<!--raw-typst <authored-views> -->


Status: **Implemented**.

## Decision


An authored view is a read-only resource declared in schema. It projects fields
and direct relations from a base table without hand-written SQL. `x-view: true`
marks a view; a top-level `x-source` is read only when `x-view` is true.

## Rules


- Every view has `x-source` naming its base table.
- Every property has an `x-source` path beginning with the base table name.
- `id`, `owner` and `visibility` are required and come directly from the base
  row.
- A column path may follow `one` relations, such as `article.author.name`, and
  must not cross a `many` relation.
- A relation-valued property names a direct relation of the base table: `type:
  object` for `one`, `type: array` for `many`.
- Views must not declare `x-relations`, be shareable, inherit access, or be
  written through the API.
- A view reads only exposed tables, columns, relations and join tables.

## Access


Reads inherit the base table's `read`, `signed` and `roles` policy. A view may
be stricter, but it cannot make a session-only table public or drop a
signature or role requirement. Writes return `405`.

## Known limits


- Nested relation-valued properties are rejected.
- A scalar column projected through a related row is not filtered by that
  related row's read policy.
- The database view builds every embedded relation, even when a request asks
  for a sparse fieldset.
