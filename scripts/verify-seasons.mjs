// Verifies the season rollover + wager settlement SQL (0008) with PGlite —
// applies every migration, then exercises close_and_rollover_season end-to-end.
// Run with: node scripts/verify-seasons.mjs

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

const AUTH_STUB = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select 'authenticated'::text
$$;
`;

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
}
async function scalar(db, sql) {
  const res = await db.query(sql);
  const row = res.rows[0];
  return row ? Object.values(row)[0] : undefined;
}

const db = new PGlite();
try {
  await db.exec(AUTH_STUB);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    try {
      await db.exec(readFileSync(join(migrationsDir, f), "utf8"));
    } catch (e) {
      console.error(`\nFAILED applying ${f}:\n  ${e.message}`);
      process.exit(1);
    }
  }
  console.log(`applied ${files.length} migrations`);
  console.log("\nseason rollover smoke tests:");

  // Two players in a squad.
  const u1 = await scalar(
    db,
    `insert into auth.users (email) values ('owner@x.com') returning id`,
  );
  const u2 = await scalar(
    db,
    `insert into auth.users (email) values ('rival@x.com') returning id`,
  );
  await db.exec(`set app.user_id = '${u1}'`);
  const grp = (await db.query(`select * from public.create_group('Squad')`))
    .rows[0];
  const oldSeasonId = grp.active_season_id;
  await db.exec(`set app.user_id = '${u2}'`);
  await db.query(`select public.join_group_by_code('${grp.invite_code}')`);

  // Daily scores within the season window: u1 leads, u2 trails.
  await db.query(
    `insert into public.daily_scores (user_id, group_id, date, xp_earned, targets_hit, habits_total)
     values ('${u1}','${grp.id}', current_date, 300, 2, 2)`,
  );
  await db.query(
    `insert into public.daily_scores (user_id, group_id, date, xp_earned, targets_hit, habits_total)
     values ('${u2}','${grp.id}', current_date, 100, 1, 2)`,
  );

  // Owner sets the wager, then the season rolls over.
  await db.exec(`set app.user_id = '${u1}'`);
  await db.query(`select public.set_wager('${grp.id}', 'loser buys coffee')`);
  const newSeason = (
    await db.query(`select * from public.close_and_rollover_season('${grp.id}')`)
  ).rows[0];

  // season_scores ranked.
  check(
    (await scalar(
      db,
      `select count(*)::int from public.season_scores where season_id='${oldSeasonId}'`,
    )) === 2,
    "season_scores snapshot has a row per member",
  );
  const u1rank = await scalar(
    db,
    `select rank from public.season_scores where season_id='${oldSeasonId}' and user_id='${u1}'`,
  );
  const u2rank = await scalar(
    db,
    `select rank from public.season_scores where season_id='${oldSeasonId}' and user_id='${u2}'`,
  );
  check(Number(u1rank) === 1 && Number(u2rank) === 2, "leader ranks #1, rival #2");

  // Wager settled against the loser.
  const wager = (
    await db.query(
      `select status, loser_id from public.wagers where group_id='${grp.id}'`,
    )
  ).rows[0];
  check(
    wager?.status === "settled" && wager?.loser_id === u2,
    "open wager settled with the last-place loser",
  );

  // Champion badge to the top scorer.
  check(
    (await scalar(
      db,
      `select count(*)::int from public.user_badges ub
       join public.badges b on b.id = ub.badge_id
       where ub.user_id='${u1}' and b.key='champion'`,
    )) === 1,
    "champion badge awarded to the top scorer",
  );

  // Freezes replenished for both members.
  check(
    (await scalar(
      db,
      `select count(*)::int from public.profiles p
       join public.group_members gm on gm.user_id = p.id
       where gm.group_id='${grp.id}' and p.streak_freezes = 1`,
    )) === 2,
    "streak freezes replenished (+1) for all members",
  );

  // Old season closed, new active season is now the group's active season.
  check(
    (await scalar(
      db,
      `select is_active from public.seasons where id='${oldSeasonId}'`,
    )) === false,
    "previous season deactivated",
  );
  const activeId = await scalar(
    db,
    `select active_season_id from public.groups where id='${grp.id}'`,
  );
  check(
    activeId === newSeason.id && newSeason.is_active === true,
    "a new active season opened and is set on the group",
  );
  check(
    newSeason.name === "Season 2",
    `next season is named sequentially (${newSeason.name})`,
  );

  await db.close();
  if (failures > 0) {
    console.error(`\nSEASONS VERIFY: FAIL — ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nSEASONS VERIFY: PASS");
  process.exit(0);
} catch (e) {
  console.error(`\nSEASONS VERIFY: FAIL — ${e.message}`);
  process.exit(1);
}
