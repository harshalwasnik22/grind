// Verifies the Supabase migrations actually execute, using PGlite (in-process
// WASM Postgres — no Docker needed). Run with: npm run db:verify
//
// Runs as superuser, so RLS is not *enforced* here; this validates DDL,
// functions, triggers, constraints, seed data and the core data flow. RLS
// policy *syntax* is validated by CREATE POLICY succeeding.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

// Stub the Supabase-provided `auth` schema for local verification only.
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
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
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
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    try {
      await db.exec(sql);
      console.log(`applied ${f}`);
    } catch (e) {
      console.error(`\nFAILED applying ${f}:\n  ${e.message}`);
      process.exit(1);
    }
  }

  console.log("\nsmoke tests:");

  // 1. New auth users auto-create profiles via trigger.
  const u1 = await scalar(
    db,
    `insert into auth.users (email) values ('a@example.com') returning id`,
  );
  const u2 = await scalar(
    db,
    `insert into auth.users (email) values ('b@example.com') returning id`,
  );
  check(
    (await scalar(db, `select count(*)::int from public.profiles`)) === 2,
    "handle_new_user trigger created a profile for each auth user",
  );

  // 2. create_group as user 1.
  await db.exec(`set app.user_id = '${u1}'`);
  const grp = (await db.query(`select * from public.create_group('Test Squad')`))
    .rows[0];
  check(
    !!grp && typeof grp.invite_code === "string" && grp.invite_code.length === 6,
    `create_group returns a group with a 6-char invite code (${grp?.invite_code})`,
  );
  check(!!grp.active_season_id, "group.active_season_id is set");
  check(
    (await scalar(
      db,
      `select count(*)::int from public.group_members where group_id='${grp.id}' and role='owner'`,
    )) === 1,
    "creator is recorded as the owner member",
  );
  check(
    (await scalar(
      db,
      `select count(*)::int from public.seasons where group_id='${grp.id}' and is_active`,
    )) === 1,
    "an active season was created",
  );

  // 3. join_group_by_code as user 2.
  await db.exec(`set app.user_id = '${u2}'`);
  await db.query(`select public.join_group_by_code('${grp.invite_code}')`);
  check(
    (await scalar(
      db,
      `select count(*)::int from public.group_members where group_id='${grp.id}'`,
    )) === 2,
    "join_group_by_code adds the second member",
  );
  // lowercase code should still match (function upper-cases input)
  let rejoinOk = true;
  try {
    await db.query(
      `select public.join_group_by_code('${grp.invite_code.toLowerCase()}')`,
    );
  } catch {
    rejoinOk = false;
  }
  check(rejoinOk, "invite code match is case-insensitive");
  let invalidRaised = false;
  try {
    await db.query(`select public.join_group_by_code('ZZZZZZ')`);
  } catch {
    invalidRaised = true;
  }
  check(invalidRaised, "an invalid invite code raises");

  // 4. Habit → log → daily score → rest day.
  await db.exec(`set app.user_id = '${u1}'`);
  const habitId = await scalar(
    db,
    `insert into public.habits (user_id, group_id, name, category, unit, daily_target, base_xp)
     values ('${u1}','${grp.id}','DSA','dsa','problems',2,120) returning id`,
  );
  await db.query(
    `insert into public.habit_logs (habit_id, user_id, log_date, value)
     values ('${habitId}','${u1}', current_date, 2)`,
  );
  await db.query(
    `insert into public.daily_scores (user_id, group_id, date, xp_earned, targets_hit, habits_total)
     values ('${u1}','${grp.id}', current_date, 120, 1, 1)`,
  );
  await db.query(
    `insert into public.rest_days (user_id, date) values ('${u1}', current_date - 1)`,
  );
  check(true, "habit + log + daily_score + rest_day insert cleanly");

  let dupRaised = false;
  try {
    await db.query(
      `insert into public.habit_logs (habit_id, user_id, log_date, value)
       values ('${habitId}','${u1}', current_date, 3)`,
    );
  } catch {
    dupRaised = true;
  }
  check(dupRaised, "habit_logs unique(habit_id, log_date) is enforced");

  // 5. Seed catalogs populated.
  const nTemplates = await scalar(
    db,
    `select count(*)::int from public.habit_templates`,
  );
  const nBadges = await scalar(db, `select count(*)::int from public.badges`);
  const nTitles = await scalar(db, `select count(*)::int from public.titles`);
  check(nTemplates > 0, `habit_templates seeded (${nTemplates})`);
  check(nBadges > 0, `badges seeded (${nBadges})`);
  check(nTitles > 0, `titles seeded (${nTitles})`);

  await db.close();

  if (failures > 0) {
    console.error(`\nSCHEMA VERIFY: FAIL — ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log(
    `\nSCHEMA VERIFY: PASS (${files.length} migrations, smoke tests ok)`,
  );
  process.exit(0);
} catch (e) {
  console.error(`\nSCHEMA VERIFY: FAIL — ${e.message}`);
  process.exit(1);
}
