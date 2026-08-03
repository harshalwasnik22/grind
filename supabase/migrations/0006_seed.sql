-- ===========================================================================
-- 0006_seed.sql — starter habit templates, badge & title catalogs
-- ===========================================================================

insert into public.habit_templates (category, name, unit, default_target, base_xp, sort_order) values
  ('dsa',           'DSA problems',        'problems', 2,  120, 1),
  ('system_design', 'System design study', 'topics',   1,  120, 2),
  ('gym',           'Gym session',         'sessions', 1,  100, 3),
  ('learning',      'Learn new tech',      'minutes',  30, 80,  4),
  ('learning',      'Technical reading',   'pages',    20, 60,  5)
on conflict (name) do nothing;

insert into public.badges (key, name, description, icon, criteria, xp_reward) values
  ('first-blood',  'First Blood',   'Log your very first quest.',                '🩸', '{"type":"first_log"}',                                 25),
  ('week-streak',  'On Fire',       'Reach a 7-day streak.',                     '🔥', '{"type":"streak_at_least","days":7}',                  150),
  ('month-streak', 'Unstoppable',   'Reach a 30-day streak.',                    '⚡', '{"type":"streak_at_least","days":30}',                 500),
  ('perfect-week', 'Flawless',      'Hit every target for 7 days straight.',     '💎', '{"type":"perfect_week"}',                              300),
  ('century-dsa',  'Century',       'Solve 100 DSA problems.',                   '🧮', '{"type":"category_total_at_least","category":"dsa","count":100}',    400),
  ('gym-rat',      'Gym Rat',       'Complete 20 gym sessions.',                 '🏋️', '{"type":"category_total_at_least","category":"gym","count":20}',     300),
  ('polyglot',     'Polyglot',      'Log learning on 30 different days.',        '📚', '{"type":"category_days_at_least","category":"learning","days":30}',  300),
  ('level-10',     'Veteran',       'Reach level 10.',                           '🎖️', '{"type":"level_at_least","level":10}',                 0),
  ('champion',     'Champion',      'Finish #1 at the end of a season.',         '🏆', '{"type":"season_rank","rank":1}',                      500)
on conflict (key) do nothing;

insert into public.titles (key, name, description, unlock_rule) values
  ('grindling', 'Grindling', 'Every legend starts here.',        '{"type":"level_at_least","level":1}'),
  ('grinder',   'Grinder',   'Reach level 5.',                   '{"type":"level_at_least","level":5}'),
  ('grindlord', 'Grindlord', 'Reach level 10.',                  '{"type":"level_at_least","level":10}'),
  ('ascended',  'Ascended',  'Prestige at least once.',          '{"type":"prestige_at_least","prestige":1}'),
  ('champion',  'Champion',  'Win a season.',                    '{"type":"season_rank","rank":1}')
on conflict (key) do nothing;
