---
name: supabase-flatten
description: Run a Supabase project in development with no migrations. Flattens supabase/migrations/ into a supabase/schemas/ tree (one SQL file per table, view and function, exported by pg-delta), applies edits to that tree straight to the dev database with no migration file, resets the database to the latest schema plus seed, and turns the tree back into one baseline migration when the project goes live. Use it in a project that is already flattened (it has supabase/schemas/.pgdelta-export.json and no migration files) to change, apply, reset or graduate its schema, or when the user explicitly asks to flatten, squash or get rid of this project's migrations. Never flatten a project on your own because it is Phase dev or because a schema change was asked for. Not for projects marked Phase live.
---

# Supabase flatten

While a project is in development nothing about its schema is final, and a pile of migrations is only history nobody needs. This skill swaps `supabase/migrations/` for a `supabase/schemas/` tree that is the schema: you edit a table's file and apply it, and pg-delta works out the DDL against the live dev database. No migration files exist until the project goes live.

The script is `scripts/flat.sh` in this skill's base directory. Run it from the project root (the folder holding `supabase/config.toml`). It needs bun, the Supabase CLI, git, and psql for seeding. It refuses to run when the project's `CLAUDE.md` says `Phase: live`.

| Command | What it does |
| --- | --- |
| `flat.sh flatten [--db-url URL]` | Exports the database to `supabase/schemas/`, checks the tree reloads to the same database (0 planned actions), then `git rm`s `supabase/migrations/` and turns off `[db.seed]` |
| `flat.sh apply [--db-url URL] [flags]` | Applies `supabase/schemas/` to the database, no migration written. Flags go to `pgdelta schema apply` |
| `flat.sh reset` | Local only: empties the database, applies the tree, runs `supabase/seed.sql` |
| `flat.sh graduate` | Dumps the local database to one `supabase/migrations/<ts>_baseline.sql` and turns `[db.seed]` back on |

Without `--db-url` (or `DB_URL` in the environment) the target is the local stack from `supabase status`.

## Flatten a project

Only when the user asks to flatten this project. In a repo other people commit to, flatten stops and says how many there are: tell the user that once the change is pushed, their `supabase start` and `supabase db reset` give an empty database until they run `flat.sh reset`, and rerun with `FLAT_SHARED_OK=1` only after the user agrees.

1. `supabase start`. If the local database has drifted from the migrations and you don't want that drift, `supabase db reset` first. Flatten exports whatever the database holds now.
2. Commit `supabase/migrations/`. Flatten refuses uncommitted migrations, because git is the only copy it leaves.
3. `flat.sh flatten`.
4. Commit `supabase/schemas/` (with `.pgdelta-export.json`, which records the load order) and `supabase/config.toml`.
5. If the project's `CLAUDE.md` has no phase marker, add `Phase: dev`.

## Change the schema

Edit the files under `supabase/schemas/`, then `flat.sh apply`.

- Write the end state: add a column inside the `create table`, don't append `alter table … add column`. pg-delta loads the files into a temporary shadow database, diffs it against the dev database, and runs the DDL it derives, not your file.
- The layout is only for reading. Any `.sql` under the tree loads, so a new table goes in `<schema>/tables/<name>.sql` next to its siblings.
- Output ends with `Planning: N action(s)` and `Applied N action(s)`. Pass `--dry-run` to print the SQL without applying it.
- `refusing N data-destructive action(s) without --allow-data-loss` lists the statements. If they are the drop you meant, rerun with `--allow-data-loss`; dev data is disposable and `reset` brings the seed back. A rename shows as a drop plus an add; rerun with the `--accept-rename <from>=<to>` the output prints to keep the data.
- `dangling_edge` warnings about `auth`, `vault` and `realtime`, and the `reorder assist unavailable` and `raw loading` warnings, are expected.

## Changes made outside the files

Studio, the SQL editor or psql change the database, not the files, and the next `apply` reverts them. To keep them, apply or commit any pending file edits, run `flat.sh flatten` again (with no migrations left it only re-exports), and review `git diff`.

## Seed data and fresh machines

Rows are not schema. They live in `supabase/seed.sql`, and DML in a schema file is an error. Because flatten turns off `[db.seed]`, `supabase start` on a fresh clone gives an empty database; run `flat.sh reset` after it. Don't use plain `supabase db reset` in this mode: with no migrations it leaves an empty database.

## Objects pg-delta doesn't model

Casts, operators, text-search configuration, statistics objects, languages and transforms are reported, not exported. Their SQL goes in `supabase/schemas/_custom/`, which pg-delta loads into its shadow only, never into the target. Run those files on the dev database yourself (`psql "$DB_URL" -f <file>`), and again after every `reset`.

## A remote dev project

`flat.sh apply --db-url "$DEV_DB_URL"` with the URL in an environment variable, so the password stays out of the transcript. pg-delta creates its temporary shadow database on that cluster and drops it afterwards. `reset` is local only; for a remote, run `supabase db reset --linked --no-seed`, then `flat.sh apply --db-url "$DEV_DB_URL"`.

## Going live

1. `flat.sh reset`, so the local database is exactly the tree.
2. `flat.sh graduate`.
3. `supabase db reset` to prove the baseline replays and seeds.
4. Switching `CLAUDE.md` to `Phase: live` is the user's call; ask. From then on keep editing `supabase/schemas/` and write migrations with `supabase db schema declarative sync` (it needs `[experimental.pgdelta] enabled = true`, the default in new projects). Straight after graduating it reports `No schema changes found`.

## Don't, in this mode

- `supabase db diff` or `supabase migration new`: they write migrations.
- `supabase db push`: there is nothing to push. Apply to a remote dev project with `--db-url`.
