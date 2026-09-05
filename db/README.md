# `db/`

| File | What it is | Safe against D1? |
| --- | --- | --- |
| `schema.sql` | Tables, indexes, views. The deployable artifact. | **yes** |
| `reset.sql` | Drops everything. | local only |
| `seed.sql` | Dummy guests. Built as the matcher's test plan. | local only |
| `verify.sql` | Read-only PASS/FAIL assertions. | yes |
| `guests/` | Real guest batches, idempotent. See `docs/d1-deployment.md`. | yes |
| `dev-shell.sql` | Loader for the interactive `sqlite3` shell. | **no** — contains CLI dot-commands |
| `backups/` | `wrangler d1 export` dumps. Gitignored: real replies, phone numbers. | — |

Two ways to work locally. The `sqlite3` path is faster and gives you real error
messages; the `wrangler` path proves it works in the runtime the Worker uses.

---

## The `sqlite3` path

### Load

From the **repo root** (dot-command paths resolve against your shell's current
directory, not against the file doing the reading):

```bash
rm -f /tmp/wedding.db
sqlite3 /tmp/wedding.db
```

```
sqlite> .read db/dev-shell.sql
```

That drops, rebuilds, seeds, turns foreign keys on, and prints a row count.

Non-interactive equivalent, for when you just want it rebuilt:

```bash
rm -f /tmp/wedding.db
cat db/reset.sql db/schema.sql db/seed.sql | sqlite3 /tmp/wedding.db
sqlite3 -box -header /tmp/wedding.db < db/verify.sql
```

Note `-box -header` as command-line flags — piping stdin gives you no chance to
set `.mode` first, and the default pipe-delimited output is miserable to read.

### Validate

```
sqlite> .read db/verify.sql
```

Twelve labelled assertions, each PASS or FAIL, then a dump of `rsvp_summary`
and `rsvp_headcount`. Expect 11 PASS on a freshly seeded local database.

Spot checks:

```sql
-- the disambiguation case: two Johns, one search key, different households
SELECT g.first_name, g.middle_name, g.last_name, g.name_key, g.search_key, p.label
FROM guests g JOIN parties p ON p.id = g.party_id
WHERE g.search_key = 'john banda';

-- everyone who will hit the confirmation screen
SELECT search_key, COUNT(*) n FROM guests GROUP BY search_key HAVING n > 1;

-- who is coming, guests and plus-ones together
SELECT kind, name, household, via, status, dietary FROM rsvp_summary
WHERE status = 'attending';

SELECT * FROM rsvp_headcount;
```

Confirm the constraints actually bite. Each of these must ERROR:

```sql
INSERT INTO rsvps (guest_id, attending, dietary) VALUES (1, 1, 'kosher');   -- CHECK
INSERT INTO parties (label) VALUES ('The Banda Family');                    -- UNIQUE
INSERT INTO rsvps (guest_id, attending) VALUES (9999, 1);                   -- FK (needs the PRAGMA)
```

The third only fails if `PRAGMA foreign_keys = ON` ran on **this** connection.
It is not persisted in the file, so it is off again every time you reopen the
shell. `dev-shell.sql` sets it; if you loaded some other way, set it yourself.

### Dot-commands worth knowing

| | |
| --- | --- |
| `.read FILE` | run a SQL file (path relative to your shell's cwd) |
| `.tables` | list tables and views |
| `.schema guests` | the exact DDL, generated columns and CHECKs included |
| `.indexes guests` | indexes on one table |
| `.mode box` \| `column` \| `json` \| `csv` | output format (`box` needs SQLite ≥ 3.33) |
| `.headers on` | column names |
| `.nullvalue ·` | show NULL as something visible instead of an empty cell |
| `.changes on` | print rows affected after each write |
| `.bail on` | stop at the first error |
| `.once out.csv` / `.output` | send the next result / all results to a file |
| `.import --csv file.csv table` | bulk-load a CSV |
| `.dump` | full SQL dump |
| `.quit` | exit (or Ctrl-D) |

If the prompt changes to `...>` you have an unterminated statement — SQLite is
waiting for a `;`. Ctrl-C gets you out.

---

## The `wrangler` path

Same three files, applied to the Miniflare-backed local D1 the Worker actually
reads:

```bash
cd api
npm run db:reset      # drop -> schema -> seed
npm run db:verify
npm run rsvps         # rsvp_summary
npm run heads         # rsvp_headcount
npm run db:sql -- "SELECT * FROM guests WHERE search_key='john banda'"
```

That database lives at
`api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`, and you can
open it with `sqlite3` directly if you want the nicer shell against the real
local state:

```bash
sqlite3 "$(ls api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | head -1)"
```

Do that read-only. Writing to it behind Miniflare's back works but is a good
way to confuse yourself about which database you are looking at.

---

## There are two local databases. Do not confuse them.

| | Who reads it | How you seed it |
| --- | --- | --- |
| `/tmp/wedding.db` | you, in the `sqlite3` shell | `cat db/reset.sql db/schema.sql db/seed.sql \| sqlite3 /tmp/wedding.db` |
| `api/.wrangler/state/v3/d1/...` | **`wrangler dev`, i.e. the Worker** | `cd api && npm run db:reset` |

They are separate files with no connection to each other. Seeding the scratch
one and then starting the API is the single most likely reason for "the search
returns nothing but I definitely added guests".

Rule of thumb: `/tmp/wedding.db` is for checking that SQL is *correct*;
`npm run db:reset` is for making the *app* work.

## Running the stack

Two terminals. `web/vite.config.ts` proxies `/api` to `127.0.0.1:8787`, so both
must be up or every request 404s at Vite instead of reaching the Worker.

```bash
# terminal 1
cd api && npm run db:reset && npm run dev      # Worker on :8787

# terminal 2
cd web && npm run dev                          # Vite on :5173
```

Open `http://localhost:5173/rsvp`. Hit the Worker directly to tell the two
apart when something breaks:

```bash
curl http://127.0.0.1:8787/api/health
```

If that works but the browser doesn't, the problem is the proxy, not the API.
