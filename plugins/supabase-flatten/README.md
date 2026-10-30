# supabase-flatten

A skill for Supabase projects that are still in development. Instead of a growing pile of migrations, the schema lives in `supabase/schemas/`, one SQL file per table, view and function. You edit a file, and [pg-delta](https://github.com/supabase/pg-toolbelt/tree/main/packages/pg-delta) diffs it against the dev database and applies the difference. No migration file is written until the project goes live.

```bash
/plugin install supabase-flatten@claude-mods
```

Then ask Claude to flatten a project's migrations. It never flattens a project you haven't asked it to, and in a repo other people commit to it stops and asks first, since once pushed their `supabase start` and `supabase db reset` give an empty database until they run `flat.sh reset`. In a flattened project, Claude uses it for every schema change.

To keep it to the projects you choose, turn it off for your account and on per project (`local` is just you, not committed):

```bash
claude plugin disable supabase-flatten@claude-mods --scope user
claude plugin enable supabase-flatten@claude-mods --scope local   # in each project
```

## What it runs

`skills/supabase-flatten/scripts/flat.sh`, from the project root:

| Command | What it does |
| --- | --- |
| `flatten` | Exports the database to `supabase/schemas/`, checks the tree reloads to the same database, then removes `supabase/migrations/` with `git rm` and turns off `[db.seed]` |
| `apply` | Applies `supabase/schemas/` to the dev database (local, or `--db-url`) |
| `reset` | Empties the local database, applies the tree, runs `supabase/seed.sql` |
| `graduate` | Dumps the database to one baseline migration and turns `[db.seed]` back on |

After `graduate`, `supabase db schema declarative sync` keeps writing migrations from the same tree.

## Requirements

- bun (runs `@supabase/pg-delta` through `bunx`; pin another version with `PGDELTA_VERSION`)
- the Supabase CLI and Docker for the local stack
- git (flatten won't delete uncommitted migrations)
- psql for seeding

The script refuses to run in a project whose `CLAUDE.md` says `Phase: live`.
