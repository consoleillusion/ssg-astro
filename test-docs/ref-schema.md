# Schema reference
<!--raw-typst <ref-schema> -->


Status: **Implemented**.

A schema is a JSON Schema object. User schemas live in `src/schema/` and system
schemas in `src/schema/system/`. The loader validates each file and the builder
derives tables, relations, views, and API resources.

## File formats

Schema files are `.json`, `.yaml`, or `.yml`:

- `.json` files hold exactly one schema object.
- `.yaml` and `.yml` files may hold several schemas, one per `---` document.
  Every document is named by its own `title`, so a file can be named anything
  and hold any number of schemas.
- A schema folder is read one level deep; subdirectories are not loaded.
- `$ref` to another file or to `$defs` is resolved when the schema is loaded;
  circular references fail.
- `*.test.json`, `*.test.yaml`, and `*.test.yml` files, dotfiles,
  `README*`, and `LICENSE*` are skipped.

The loader fails loudly instead of skipping silently:

- an unrecognized file in a schema folder (anything that is not one of the
  three extensions above, and not skipped) errors, listing every offending
  file;
- a `.json`, `.yaml`, or `.yml` file whose top level is not a schema object
  (it needs a `title` and either `properties` or `type: object`) errors, naming
  the file and, for YAML, the document number;
- a YAML file with a syntax error or with no documents at all errors.

## Nullable properties

A union with `"null"`, such as `type: ["integer", "null"]`, collapses onto its
single non-null member (`integer`), recursively through nested `properties`
and `items`. Nullability itself comes from `required`: a property that is not
listed there stays nullable, with `null` stored when the request omits it. A
union with two or more non-null types, or with `"null"` only, fails loudly,
naming the schema and the property.

## Supported keywords

| **Keyword** | **Effect** |
| --- | --- |
| `title` | Table name after snake\_case conversion; also drives the export name |
| `description` | Documentation only |
| `type` | Base SQLite type; must be `object` for a table |
| `properties` | Columns |
| `required` | `NOT NULL` constraints (default columns are always required) |
| `default` | Column default |
| `format` | Specialized type mapping (`uuid`, `date-time`, `byte`, `email`) |
| `enum` | Text column with enum typing |
| `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `multipleOf`, `items`, `properties`, `required` | Validation metadata; the full property schema is enforced on writes |
| `readOnly` | Standard JSON Schema: clients can read the attribute but writes to it are rejected with 400 |
| `x-unique` | Unique constraint |
| `x-primary` | Marks the property that identifies rows, in place of the generated `id` (see *Keys*) |
| `x-system` | Always-loaded system schema |
| `x-view` / `x-source` | Authored read-only view over a base table |
| `x-exposed` | `false` hides the table, property, or relation |
| `x-access` | Reads, creates, visibility, sharing, signing, roles, and audit |
| `x-relations` | Relation metadata |
| `x-unique-constraints` | Table-level unique constraints over column groups |
| `x-link-any` | Internal: allows a relation to reference rows the writer cannot read |
| `x-append-only` | `true` generates triggers that reject every `UPDATE` and `DELETE` on the table |


`additionalProperties: false` is conventional in this repository but is not the
only accepted value.

## Type mapping

| **JSON Schema** | **SQLite** |
| --- | --- |
| `string` | `text` |
| `string` with `format: uuid` | `blob`, default `uuid7()` when used as an ID |
| `string` with `format: date-time` | `integer` timestamp |
| `string` with `format: byte` | `blob` |
| `integer` | `integer` |
| `number` | `real` |
| `boolean` | `integer` boolean |
| `object` | `text` JSON |
| `array` | `text` JSON |
| string `enum` | `text` with enum typing |
| `[T, "null"]` | collapses to `T`; nullability comes from `required` |


Column names are snake\*cased. API attribute names are the snake\*case column
names.

## Default columns

The builder injects these columns into every table when they are not declared:

- `id` — UUID primary key;
- `updated_at` — timestamp;
- `owner` — nullable UUID foreign key to `user.id`.

See [Data model](#ref-data-model) for their semantics. A schema may declare
`id`, `updated_at`, or `owner` explicitly; the builder preserves the declared
position and type rules. `owner` must remain a UUID column.

## Keys

A table is keyed by its generated `id` unless one property is marked
`x-primary: true`. That property then replaces `id`: it is the table's primary
key, and its value is the resource id in URLs and documents.

```yaml
properties:
  customer_no:
    type: integer
    x-primary: true
```

| **Key type** | **New rows** | **Ids in the API** |
| --- | --- | --- |
| `integer` | Assigned by the database (the next number) unless the client sends `data.id` | Decimal digits as a string: `"42"` |
| `string` | The client must send `data.id`; a duplicate is 409 | The text itself, 1 to 255 characters |
| `string`, `format: uuid` | Generated, as for `id` | A canonical UUID |


- The key is never an attribute: it appears only as the resource id, and the
  catalog does not list it.
- Relations, join tables, share tables, filters across relations and the
  audit log all use the key. A `one` relation's `column` defaults to the target
  table's key, and its foreign key column takes the key's type.
- Because the key is in the schema file, building the same schemas again
  always gives the same table: running `init` twice changes nothing.
- Only one property can be `x-primary`, it must be an integer or a string
  (`uuid` is the only format allowed), and the table cannot also have a column
  named `id`.
- Authored views need a base table keyed by `id`.

## `x-exposed`

`x-exposed` defaults to `true`. Setting it to `false` removes the declaration
from the public surface.

### Tables

```json
{
  "title": "Key",
  "type": "object",
  "x-exposed": false,
  "properties": { "...": "..." }
}
```

A hidden table:

- has no registry resource or catalog entry;
- has no generated public view;
- cannot be read, created, updated, or deleted through `/:type` routes;
- is omitted from the relations of other resources.

The table and its data still exist. An application service, such as the auth
service, can access it directly.

### Properties

```json
{
  "properties": {
    "internal_note": {
      "type": "string",
      "x-exposed": false
    }
  }
}
```

A hidden property is omitted from generated views, serializers, query fields,
and write validation. It is still present in the table and can be read or written
by trusted server code.

### Relations

```json
{
  "x-relations": {
    "audit": {
      "table": "audit_log",
      "column": "id",
      "cardinality": "many",
      "x-exposed": false
    }
  }
}
```

A hidden relation is omitted from the registry, serializers, and `include`
validation. Relations that target a hidden table are hidden automatically. A
derived join table is hidden when either endpoint or the relation is hidden.

### Validation

`x-exposed` must be a boolean on tables, properties, and relations. Any other
value fails schema building.

## Relations

Relations are declared under `x-relations`.

```json
{
  "x-relations": {
    "member": {
      "table": "user",
      "column": "id",
      "cardinality": "one",
      "foreignKey": "member_id",
      "onDelete": "set null"
    },
    "groups": {
      "table": "user_group",
      "column": "id",
      "cardinality": "many",
      "through": "user_group_membership",
      "onDelete": "cascade"
    }
  }
}
```

### Relation fields

| **Field** | **Meaning** |
| --- | --- |
| `table` | Target table |
| `column` | Target column, default the target table's key (`id`, or its `x-primary` property) |
| `cardinality` | `one` or `many` |
| `foreignKey` | Optional foreign-key column override for `one` |
| `through` | Optional join-table name override for `many` |
| `required` | For `one`: the foreign key is `NOT NULL`. For `many`: the relation always keeps at least one member |
| `onDelete` | Foreign-key delete action |
| `onUpdate` | Foreign-key update action |
| `x-exposed` | `false` hides the relation |


`x-link-any` is an internal escape hatch for system resources. A `many` relation
may use it only with a `through` join table: inverse-one relations rewrite the
target rows, so linking outside the writer’s scope would let them take over
another user’s row.

### `one` relation

A `one` relation adds a foreign-key column when it does not exist:

- the default column name is `<target_table>_<target_column>`, for example
  `user_id` for `user.id`, or `foreignKey` when provided;
- the column type follows the target key type (UUID by default);
- the column is indexed;
- `required: true` makes it `NOT NULL`;
- the target must exist and the target column must exist;
- the target must be a key column.

`onDelete` and `onUpdate` are passed through to the generated foreign key.
`owner` is added separately and always references `user.id` with
`ON DELETE SET NULL`.

### `many` relation

A `many` relation without `through` produces a derived join table named after the
sorted endpoint pair, for example `article_tag`. The join table has:

- `id`, `updated_at`, and `owner`;
- both endpoint foreign keys, `NOT NULL`;
- a unique constraint on the endpoint pair;
- a trigger and a view.

With `required: true`, a create or a `PUT` must give at least one member, and
a `PATCH` or a relationship request cannot leave none; each is refused with
`400` naming the relationship. Deleting the last related row itself is not
prevented: its join rows go with it.

A `many` relation with `through` uses the named join table instead of deriving a
new one. A self-referential many-to-many relation derives a join table named
`<table>_<label>` (override with `through`) with columns `<table>_id` for this
side and `related_<table>_id` for the target. It is directed: the relation lists
rows where this row is on the `<table>_id` side, so symmetry is not automatic.

### Deduplication

The builder deduplicates join tables by endpoint pair. If two schemas declare the
same many-to-many relation, only one join table is generated. Conflicting
`through` names for the same pair fail the build.

## Views

A schema marked `x-view: true` is an authored, read-only resource over a base
table. It is declared in the same folder as the tables and is not a table: no
table, trigger, join table, or share table is created for it. Its database
object is a `SELECT` view named `snakeCase(title)`.

```json
{
  "title": "Article Card",
  "type": "object",
  "x-view": true,
  "x-source": "article",
  "properties": {
    "id": { "type": "string", "format": "uuid", "x-source": "article.id" },
    "owner": {
      "type": "string",
      "format": "uuid",
      "x-source": "article.owner"
    },
    "visibility": { "type": "string", "x-source": "article.visibility" },
    "heading": { "type": "string", "x-source": "article.heading" },
    "author_name": { "type": "string", "x-source": "article.author.name" },
    "author": { "type": "object", "x-source": "article.author" },
    "tags": { "type": "array", "x-source": "article.tag" }
  }
}
```

| **Keyword** | **Where** | **Meaning** |
| --- | --- | --- |
| `x-view` | Top level | Marks the schema as an authored view; must be a boolean |
| `x-source` | Top level | The base table the view selects from |
| `x-source` | Property | A `<base>.<path>` path to a column or relation |


`x-view: true` is the discriminator. A top-level `x-source` is read only on a
schema marked `x-view: true`; on a table it is ignored.

- Every property needs an `x-source`, and the path starts with the base table.
- A column path may follow to-one relations, such as `article.author.name`. It
  may not cross a to-many relation: `article.tag.name` would produce an array of
  scalars and is rejected.
- A property whose path ends at a column becomes an attribute. A path that ends
  at a relation becomes a JSON:API relationship, embedded as a JSON object
  (`one`) or a JSON array (`many`). A property naming a to-many relation
  requires `type: array`.
- A relation-valued property must name a relation of the base table, such as
  `article.tag`. Nested relation values are rejected because filters and related
  reads only know the base row’s relations. Scalar paths may still follow
  to-one relations, such as `article.author.name`, but not to-many relations:
  a path like `article.tag.name` would produce an array of scalars. Expose the
  relation itself instead.
- Reads keep the base table’s read policy. A view may make access stricter, but
  it cannot set `read` to `public` when the base is session-only or drop the
  base’s `signed` and `roles` restrictions.
- `id`, `owner`, and `visibility` are mandatory. They must be exposed and source
  directly from `<base>.id`, `<base>.owner`, and `<base>.visibility`; `id` and
  `owner` must use `format: uuid`. Row scoping reads them from the view.
- Views declare relations as properties; `x-relations` is rejected.
- Views are always read-only. `x-access.shareable`, `x-access.inherit`, and any
  `x-access.create` other than `none` are rejected. `GET`, `HEAD`, and
  `OPTIONS` are served; writes return `405`.
- A view can read only exposed tables, columns, relations, and join tables.
- The view name must not collide with a table, a generated `<table>_view`, or
  another authored view.

The repository ships `src/schema/article_card.yaml` as a working example.

## Complete example

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Article",
  "type": "object",
  "additionalProperties": false,
  "description": "A blog article",
  "properties": {
    "heading": { "type": "string", "minLength": 2, "maxLength": 100 },
    "subheading": { "type": "string", "minLength": 1, "maxLength": 100 },
    "content": { "type": "string" }
  },
  "x-relations": {
    "tag": {
      "table": "tag",
      "column": "id",
      "cardinality": "many",
      "x-exposed": true
    }
  }
}
```

This produces:

- the `article` table with `id`, `updated_at`, `owner`, and the declared columns;
- the `article_tag` join table;
- `article_view` with a `tag` JSON array;
- `article_tag_view`;
- the `/article` JSON:API resource with a `tag` relationship;
- an `owner` attribute on `/article`.

## Changing a schema that already has data


Any change to a table's definition rebuilds that table: a new table is
created, the columns that exist in both the old and new definitions are copied
across by name, and the old table is dropped. Each migration runs in one
transaction, so a migration that fails changes nothing. Before running
the `init` command against a schema change for a database with real data, take a backup
(the `backup` command) and read the generated SQL in `.srs/migrations/`.

| **Change** | **Effect on existing rows** |
| --- | --- |
| Add an optional column | Kept; the new column is null, or its `default`. |
| Add a required column with a `default` | Kept; the new column takes the default. |
| Add a required column without a `default` | The migration fails if the table has rows, and nothing changes. Add it as optional, fill it in, then make it required. |
| Remove a column | Its values are dropped. |
| Rename a column | The same as removing one and adding another: the old values are dropped. Add the new column, copy the values, then remove the old one. |
| Rename a resource (`title`) | A new, empty table is created and the old one is dropped with its rows. |
| Remove a resource | Its table is dropped with its rows. |
| Change a column's `type` or `format` | Values are copied as stored; check they still suit the new type. |
| Tighten a constraint (`x-unique`, `enum`, required, visibility values) | The migration fails if existing rows break it, and nothing changes. |
| Change a relation from `one` to `many` (or back) | The foreign-key column or join table is replaced; existing links are lost. |
| Change `x-access`, `x-exposed`, descriptions or limits enforced only on writes | No data change. |


These behaviours are tested in `spec/unit/db/schema-changes.test.ts`.

## Templates


`templates/` holds schema folders for common patterns. Copy one into a project
and run the `init` command on it; each is tested end to end (`spec/templates.test.ts`).

| **Template** | **Pattern** |
| --- | --- |
| `owned-notes` | Private rows only their owner can read or change; the default, with no `x-access`. |
| `shared-documents` | Rows the owner shares with users or groups, read-only or editable; every change audited. |
| `public-catalog` | Rows anyone can read, that only holders of an `editor` role can create or change; a to-one relation between two resources. |
| `chat` | A shareable parent whose children inherit read access from it (`x-access.inherit`). |


## Meta-schema


Each schema is checked against the meta-schema in `src/db/meta-schema.ts`
before it is built. It accepts the standard JSON Schema keywords listed in
[Schema reference](#ref-schema) and the SRS keywords above, and nothing else, so a typo such as
`requried` or `x-acess` stops the build:

```text
schemas/book.yaml: document 1: invalid schema
  /properties/title/maxLenght: unsupported keyword "maxLenght"
  /x-access/read: must be one of "session", "public"
```

## Validation rules

Schema building fails when:

- a title is missing or duplicate;
- a table name is duplicate;
- two columns normalize to the same name;
- more than one primary key is declared;
- `owner` is declared with a non-UUID format;
- a `one` relation targets a missing table or column;
- a relation foreign-key column does not exist;
- a `many` relation is self-referential without `through`;
- two join tables conflict;
- an inverse-one `many` relation uses `x-link-any`;
- a unique constraint references an unknown column;
- `x-exposed` is not a boolean;
- more than one property is `x-primary`, the key is not an integer or a
  string, or a keyed table also has an `id` column;
- an authored view is missing `x-source` or a property `x-source`;
- an authored view path names a hidden table, column, or relation;
- an authored view relation property names a relation reached through another
  relation, or a column property crosses a to-many relation;
- an authored view does not expose `id`, `owner`, and `visibility` from its
  base row, or uses the wrong format;
- an authored view is shareable, inherits access, or is creatable;
- an authored view reuses a table, generated-view, or authored-view name.

Failures happen before any SQL is generated or executed.
