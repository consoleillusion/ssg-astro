# Existing databases
<!--raw-typst <existing-databases> -->


Status: **Implemented** for SQLite. PostgreSQL and MySQL sources follow
pluggable databases (v1.2.5). The questions under *Open* are not settled.

## Decision


The `import` command gives an existing SQLite database an SRS API in two
steps. The source file is only ever opened read-only.

1. **Schemas.** `import <file.db> --out schemas` writes one schema file per table,
  from the table's columns, primary key, unique constraints and foreign keys,
  and writes `import-report.md` beside the folder listing everything it could
  not carry over. The files are ordinary schemas: review them, add `x-access`
  rules, and change anything before going on.
1. **Rows.** After `init`, and after registering the user who will own the rows,
  `import <file.db> --data --owner <username>` copies every row into the SRS
  database in one transaction, with the server stopped.

Keys are kept. A table's single-column integer or text primary key becomes its
`x-primary` property ([Schema reference](#ref-schema), *Keys*), so rows keep their ids, foreign
keys keep their values, and other programs can still find rows by the ids they
know. Because the key is written into the schema file, running `init` again
always produces the same tables.

The rows are copied, not served in place: SRS needs its own columns on every
table (`owner`, `visibility`, `updated_at`) and its own tables, and adding
those to a live database another program uses could break it.

## Running it


From the repository root, with the source at `shop.db`:

```bash
bun src/cli.ts import shop.db --out schemas   # writes schemas/ and import-report.md
# review schemas/*.yaml and add x-access rules
bun src/cli.ts init schemas
# put the printed secrets in .env, then:
bun src/cli.ts serve
# register the owner (for example with the console), stop the server, then:
bun src/cli.ts import shop.db --data --owner paul
bun src/cli.ts serve
```

## Mapping


| **Source** | **Schema** |
| --- | --- |
| Table | One schema. Names become snake_case (`Customers` → `customers`). A name SRS already uses (`user`, `key`, …) gets the suffix `_imported`. |
| Column | One property, snake_case. `owner`, `visibility`, `updated_at`, and `id` when it is not the key, get the suffix `_source`. |
| Declared type | By SQLite's type affinity rules: names with `INT` → `integer`; `CHAR`, `CLOB`, `TEXT` → `string` (`maxLength` from `VARCHAR(n)`); `REAL`, `FLOA`, `DOUB` → `number`; `BLOB` or no type → bytes (`format: byte`); anything else, such as `NUMERIC` or `DECIMAL`, → `number`, reported. |
| `BOOL…` | `boolean`. |
| `DATE…`, `…TIME…` | `format: date-time`; text dates are converted to SRS timestamps, read as UTC when they carry no zone. Text that is not a date stops the copy. |
| `NOT NULL` | `required`. |
| Literal `DEFAULT` | `default`. Expressions such as `CURRENT_TIMESTAMP` are reported and left out. |
| Single-column integer or text primary key | `x-primary: true`: the key, kept as is. |
| Composite primary key, or none | The table gets SRS's uuid `id`. A composite key's columns become required and unique together. Reported. |
| `UNIQUE` column or unique index | `x-unique`, or `x-unique-constraints` for several columns. |
| Single-column foreign key to a table's primary key | A `one` relation, labelled with the target table, with `foreignKey` set to the column and `onDelete` kept. |
| Other foreign keys | Kept as plain columns. Reported. |
| Views, triggers, indexes, `CHECK` constraints | Not imported. Reported. |


## Rows


- Every column keeps its value, converted only for booleans, dates and bytes.
- Tables are copied in dependency order, so every foreign key finds its row.
  A table whose rows refer to other rows of the same table must have those
  rows in the order the foreign key needs.
- Every row is owned by `--owner` and gets the schema's default visibility
  (`private` unless the schema says otherwise). The owner can then share rows
  or open them up.
- The copy is one transaction: it all lands or none of it does. Each table's
  copy is recorded in the audit log as an `import` by the owner.
- Tables must be empty. Running `--data` a second time is refused.

## Open


- **Serving a database in place.** Whether SRS should also serve an existing
  database live, instead of a copy, and how it would add its columns without
  disturbing the other programs using it.
- **Keeping a copy in step.** Whether `--data` should be repeatable, copying only
  rows changed since the last run.
- **Owners per row.** Whether a source column (such as `created_by`) can be
  mapped to owners, matching usernames.
