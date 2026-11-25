# Schema
<!--raw-typst <schema> -->


Status: **Implemented**.

## Decision


JSON Schema is the only source of truth for the database and the API. Schema
files declare columns, relations, access rules and read-only views; the
generator derives everything else.

## Rules


- A schema `title` becomes a snake_case table name and resource type.
- Table, column and relation names are snake_case.
- Every table has `id` (a UUIDv7 stored as a 16-byte blob), `updated_at` and
  `owner`. Exposed tables also have `visibility`. A property marked
  `x-primary` replaces `id` as the key, so existing tables keep their own ids
  ([Schema reference](#ref-schema), *Keys*).
- `one` relations add a foreign-key column when one is not declared.
- `many` relations use a join table unless an inverse `one` relation exists.
- `x-exposed: false` removes a table, column or relation from every API
  surface at build time.
- `x-append-only: true` generates triggers that reject every `UPDATE` and
  `DELETE` on the table.
- Every schema file is checked, after `$ref` resolution and before any SQL is
  generated, against a meta-schema of the supported keywords
  (`src/db/meta-schema.ts`). An unknown `x-` keyword, a misspelt standard
  keyword, or a bad value fails with the file and the JSON pointer of each
  problem, all reported at once.
- Relation and access declarations are validated before any SQL is generated.
- System schemas (`user`, `user_group`, `key`, `user_role`, `audit_log`,
  `request_nonce`, `auth_limit`, `schema`) are always loaded. Account and
  transport state lives in hidden system tables, never in exposed ones.
- Key history is kept: a user that owns keys cannot be deleted
  (`onDelete: restrict`), so every retained signature stays attributable
  ([Signed requests](#requests)).

## Generated types


The `init` command writes `.srs/types.ts`: for each exposed resource, its attributes
(read-only columns marked `readonly`, optional columns as `T | null`), its
relationships, and a resource-object type, plus `Collection<T>` and `Single<T>`
document types. The client uses them as type arguments:
`client.get<Collection<'article'>>('/article')`.

## Consequences


The build is deterministic and migration generation is idempotent. The same
built schema drives the migration writer and the running application. The full
keyword reference is in [Schema reference](#ref-schema).
